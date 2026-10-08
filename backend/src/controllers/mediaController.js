import {
  getTrendingTmdb,
  TMDB_MOVIES_GENRES,
  TMDB_TV_GENRES,
  getTrendingSeriesWithDetails,
  discoverMovies,
  discoverSeries,
  searchMovie,
  searchSeries,
  getMovieDetails,
  getSeriesDetails,
  getSeasonDetails,
} from "../services/tmbdService.js";

import {
  getTrendingRawg,
  RAWG_GENRE_SLUGS,
  discoverGames,
  searchRawg,
  getGameDetails,
} from "../services/rawgService.js";

import { findOrCreateMedia, findOrCreateSeason, findOrCreateEpisode } from "../models/mediaModel.js";
import { getMediaRating, getSeriesMedia } from "../models/reviewModel.js";
import { isBlockedMedia } from "../utils/moderation.js";

function formatMovie(item) {
  return {
    id: item.id,
    source: "tmdb",
    title: item.title,
    type: "movie",
    releaseDate: item.release_date,
    meta: (item.release_date || "").slice(0, 4),
    score: item.vote_average != null ? Number(item.vote_average.toFixed(1)) : null,
    posterUrl: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
  };
}

function formatSeries(item) {
  return {
    id: item.id,
    source: "tmdb",
    title: item.name,
    type: "series",
    releaseDate: item.first_air_date,
    meta: (item.first_air_date || "").slice(0, 4),
    score: item.vote_average != null ? Number(item.vote_average.toFixed(1)) : null,
    posterUrl: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
  };
}

function formatGame(item) {
  return {
    id: item.id,
    source: "rawg",
    title: item.name,
    type: "game",
    releaseDate: item.released,
    meta: item.released ? item.released.slice(0, 4) : null,
    score: item.rating != null ? Number((item.rating * 2).toFixed(1)) : null,
    posterUrl: item.background_image,
    developer: item.developers?.[0]?.name || null,
  };
}

//trending
export async function getTrending(req, res) {
  try {
    const [tmdb, rawg] = await Promise.allSettled([
      getTrendingTmdb(),
      getTrendingRawg(),
    ]);

    const tmdbResults = tmdb.status === "fulfilled" ? tmdb.value : [];
    const rawgResults = rawg.status === "fulfilled" ? rawg.value : [];

    if (tmdb.status === "rejected")
      console.error("TMDB trending failed:", tmdb.reason.message);
    if (rawg.status === "rejected")
      console.error("RAWG trending failed:", rawg.reason.message);

    const movies = tmdbResults
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .filter((item) => !isBlockedMedia(item))
      .slice(0, 4)
      .map((item) =>
        item.media_type === "tv" ? formatSeries(item) : formatMovie(item),
      );

    const games = rawgResults.filter((item) => !isBlockedMedia(item)).slice(0, 2).map(formatGame);

    if (tmdb.status === "rejected" && rawg.status === "rejected") {
      return res.status(502).json({ error: "Trending providers unavailable" });
    }
    res.json([...movies, ...games]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error loading trending media",
    });
  }
}

//last eps

export async function getLatestEpisodes(req, res) {
  try {
    const seriesDetails = await getTrendingSeriesWithDetails();

    const episodes = seriesDetails
      .filter((show) => !isBlockedMedia(show))
      .map((show) => {
        const lastEp = show.last_episode_to_air;

        if (!lastEp || isBlockedMedia(lastEp)) return null;

        return {
          code: `S${lastEp.season_number}E${lastEp.episode_number}`,
          title: lastEp.name,
          show: show.name,
          airDate: lastEp.air_date,
          posterUrl: show.poster_path
            ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
            : null,
        };
      })
      .filter(Boolean);

    res.json(episodes);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Error loading latest episodes",
    });
  }
}

//discover

const PAGE_SIZE = 50;
const TMDB_PAGE_SIZE = 20;

// Search APIs return a limited candidate set; apply supported filters before formatting.
function filterSearch(items, type, { genre, decade, minRating }) {
  const genres = type === "game" ? RAWG_GENRE_SLUGS
    : type === "movie" ? TMDB_MOVIES_GENRES : TMDB_TV_GENRES;
  const genreValue = Object.hasOwn(genres, genre) ? genres[genre] : undefined;
  return items.filter((item) => {
    if (isBlockedMedia(item)) return false;
    const score = type === "game" ? (item.rating == null ? null : item.rating * 2) : item.vote_average;
    if (minRating > 0 && (score == null || score < minRating)) return false;
    const date = type === "game" ? item.released : type === "movie" ? item.release_date : item.first_air_date;
    const year = Number((date || "").slice(0, 4));
    if (decade !== "all" && (!year || year < Number(decade) || year > Number(decade) + 9)) return false;
    if (genreValue) {
      return type === "game" ? item.genres?.some((g) => g.slug === genreValue)
        : item.genre_ids?.includes(genreValue);
    }
    return true;
  });
}

export async function getDiscover(req, res) {
  try {
    const { types = "movie,series,game", genre = "all", decade = "all",
      minRating = 0, sortBy = "popularity", page = 1, query = "" } = req.query;
    const selectedTypes = [...new Set(String(types).split(","))]
      .filter((type) => ["movie", "series", "game"].includes(type));
    const requestedPage = Number(page);
    const pageNum = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
    const filters = { genre, decade, minRating: Number(minRating) || 0, sortBy };
    const searchQuery = String(query).trim();
    const formatters = { movie: formatMovie, series: formatSeries, game: formatGame };
    const searchers = { movie: searchMovie, series: searchSeries, game: searchRawg };
    const warnings = [];
    const genreMappings = { movie: TMDB_MOVIES_GENRES, series: TMDB_TV_GENRES, game: RAWG_GENRE_SLUGS };
    const applicableTypes = genre === "all"
      ? selectedTypes
      : selectedTypes.filter((type) => Object.hasOwn(genreMappings[type], genre));
    if (genre !== "all" && applicableTypes.length === 0) {
      return res.status(400).json({ error: "Genre is not supported for the selected media types" });
    }
    if (genre !== "all" && applicableTypes.length < selectedTypes.length) {
      const excluded = selectedTypes
        .filter((type) => !applicableTypes.includes(type))
        .map((type) => type === "game" ? "games" : type === "series" ? "series" : "movies");
      warnings.push(`${genre} is not available for ${excluded.join(" and ")}; those results were excluded.`);
    }
    const perType = Math.ceil(PAGE_SIZE / (applicableTypes.length || 1));
    if (searchQuery) warnings.push("Search filters and sorting apply to the first page of matches returned by each provider.");

    const responses = await Promise.allSettled(applicableTypes.map(async (type) => {
      if (searchQuery) {
        const raw = await searchers[type](searchQuery, genre);
        return { results: filterSearch(raw, type, filters).map(formatters[type]), hasMore: false };
      }
      if (type === "game") {
        const data = await discoverGames({ ...filters, page: pageNum, pageSize: perType });
        return { results: data.results.filter((item) => !isBlockedMedia(item)).map(formatGame), hasMore: data.hasMore };
      }
      const startIndex = (pageNum - 1) * perType;
      const startPage = Math.floor(startIndex / TMDB_PAGE_SIZE) + 1;
      const endPage = Math.ceil((startIndex + perType) / TMDB_PAGE_SIZE);
      const discover = type === "movie" ? discoverMovies : discoverSeries;
      const raw = await discover({ ...filters, startPage, endPage });
      const offset = startIndex % TMDB_PAGE_SIZE;
      const items = raw.slice(offset, offset + perType);
      // Keep the provider cursor moving even if moderation hides this entire page.
      return { results: items.filter((item) => !isBlockedMedia(item)).map(formatters[type]), hasMore: items.length === perType };
    }));
    const results = [];
    let hasMore = false;
    responses.forEach((response, index) => {
      if (response.status === "fulfilled") {
        results.push(...response.value.results);
        hasMore ||= response.value.hasMore;
      } else {
        const provider = applicableTypes[index] === "game" ? "RAWG" : "TMDB";
        console.error(provider + " " + applicableTypes[index] + " discover/search failed:", response.reason.message);
        warnings.push(provider + " " + applicableTypes[index] + " results are temporarily unavailable.");
      }
    });
    if (responses.length && responses.every((response) => response.status === "rejected")) {
      return res.status(502).json({ error: "Media providers unavailable" });
    }
    res.json({ page: searchQuery ? 1 : pageNum, pageSize: searchQuery ? results.length : PAGE_SIZE,
      results: sortResults(results, sortBy), hasMore, warnings });
  } catch (err) {
    console.error("Media discover failed:", err);
    res.status(500).json({ error: "Error loading discover results" });
  }
}

//sort
function sortResults(items, sortBy) {
  const sorted = [...items];

  switch (sortBy) {
    case "rating":
      return sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    case "release_date":
      return sorted.sort((a, b) => (b.releaseDate || b.meta || "").localeCompare(a.releaseDate || a.meta || ""));

    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));

    default:
      return sorted;
  }
}

//media deatils

export async function getMediaDetails(req, res) {
  try {
    const { type, id } = req.params;

    let detail;
    if (type === "movie") {
      const raw = await getMovieDetails(id);
      if (isBlockedMedia(raw)) return res.status(404).json({ error: "Media unavailable" });
      detail = {
        externalId: String(raw.id),
        source: "tmdb",
        type: "movie",
        title: raw.title,
        overview: raw.overview,
        posterUrl: raw.poster_path
          ? `https://image.tmdb.org/t/p/w500${raw.poster_path}`
          : null,
        releaseDate: raw.release_date,
        score: raw.vote_average != null ? Number(raw.vote_average.toFixed(1)) : null,
        genres: raw.genres?.map((g) => g.name) || [],
        cast: raw.cast.map((c) => ({
          name: c.name,
          character: c.character,
          photoUrl: c.profile_path
            ? `https://image.tmdb.org/t/p/w200${c.profile_path}`
            : null,
        })),
      };
    } else if (type === "series") {
      const raw = await getSeriesDetails(id);
      if (isBlockedMedia(raw)) return res.status(404).json({ error: "Media unavailable" });
      detail = {
        externalId: String(raw.id),
        source: "tmdb",
        type: "series",
        title: raw.name,
        overview: raw.overview,
        posterUrl: raw.poster_path
          ? `https://image.tmdb.org/t/p/w500${raw.poster_path}`
          : null,
        releaseDate: raw.first_air_date,
        score: raw.vote_average != null ? Number(raw.vote_average.toFixed(1)) : null,
        genres: raw.genres?.map((g) => g.name) || [],
        cast: raw.cast.map((c) => ({
          name: c.name,
          character: c.character,
          photoUrl: c.profile_path
            ? `https://image.tmdb.org/t/p/w200${c.profile_path}`
            : null,
        })),
        seasons: (raw.seasons || [])
          .filter((s) => s.season_number > 0 && !isBlockedMedia(s))
          .map((s) => ({
            seasonNumber: s.season_number,
            name: s.name,
            episodeCount: s.episode_count,
          })),
      };
    } else if (type === "game") {
      const raw = await getGameDetails(id);
      if (isBlockedMedia(raw)) return res.status(404).json({ error: "Media unavailable" });
      detail = {
        externalId: String(raw.id),
        source: "rawg",
        type: "game",
        title: raw.name,
        overview: raw.description_raw,
        posterUrl: raw.background_image,
        releaseDate: raw.released,
        score: raw.rating != null ? Number((raw.rating * 2).toFixed(1)) : null,
        genres: raw.genres?.map((g) => g.name) || [],
        developer: raw.developers?.[0]?.name || null,
        platforms: raw.platforms?.map((p) => p.platform.name) || [],
      };
    } else {
      return res.status(400).json({ error: "Invalid media type" });
    }

    const media = await findOrCreateMedia({
      externalId: detail.externalId,
      source: detail.source,
      type: detail.type,
      title: detail.title,
      posterUrl: detail.posterUrl,
      releaseDate: detail.releaseDate || null,
      genres: detail.genres,
    });
    if (isBlockedMedia(media)) return res.status(404).json({ error: "Media unavailable" });

    const communityScore = type === "series"
      ? await getSeriesMedia(media.id)
      : await getMediaRating(media.id);
    res.json({ ...detail, mediaId: media.id, communityScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error loading media details" });
  }
}

export async function getSeasonEpisodes(req, res) {
  const { id, seasonNumber } = req.params;
  if (!id || !/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0 ||
      !/^\d+$/.test(String(seasonNumber)) || !Number.isSafeInteger(Number(seasonNumber)) || Number(seasonNumber) <= 0) {
    return res.status(400).json({ error: "Series ID and season number must be positive integers" });
  }
  try {
    const [series, seasonData] = await Promise.all([
      getSeriesDetails(id), getSeasonDetails(id, Number(seasonNumber)),
    ]);
    if (isBlockedMedia(series) || isBlockedMedia(seasonData)) {
      return res.status(404).json({ error: "Media unavailable" });
    }
    const media = await findOrCreateMedia({
      externalId: String(series.id), source: "tmdb", type: "series", title: series.name,
      posterUrl: series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : null,
      releaseDate: series.first_air_date || null, genres: series.genres?.map((genre) => genre.name) || [],
    });
    if (media.type !== "series") throw new Error("Local media identity is not a series");
    if (isBlockedMedia(media)) return res.status(404).json({ error: "Media unavailable" });
    const season = await findOrCreateSeason(media.id, Number(seasonNumber), seasonData.name);
    const episodes = [];
    for (const raw of seasonData.episodes || []) {
      if (isBlockedMedia(raw)) continue;
      const episode = await findOrCreateEpisode(season.id, raw.episode_number, raw.name, raw.air_date);
      if (isBlockedMedia(episode)) continue;
      episodes.push({
        episodeId: episode.id, episodeNumber: raw.episode_number, title: raw.name,
        overview: raw.overview || "", airDate: raw.air_date || null,
        stillUrl: raw.still_path ? `https://image.tmdb.org/t/p/w300${raw.still_path}` : null,
      });
    }
    res.json({ seasonNumber: Number(seasonNumber), name: seasonData.name, episodes });
  } catch (err) {
    console.error("Season episodes failed:", err.message);
    res.status(500).json({ error: "Error loading season episodes" });
  }
}
