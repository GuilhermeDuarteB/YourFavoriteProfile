import {
  getTrendingTmdb,
  getTrendingSeriesWithDetails,
  discoverMovies,
  discoverSeries,
  searchMovie,
  searchSeries,
  getMovieDetails,
  getSeriesDetails,
} from "../services/tmbdService.js";

import {
  getTrendingRawg,
  discoverGames,
  searchRawg,
  getGameDetails,
} from "../services/rawgService.js";

import { findOrCreateMedia } from "../models/mediaModel.js";

function formatMovie(item) {
  return {
    id: item.id,
    source: "tmdb",
    title: item.title,
    type: "Movie",
    meta: (item.release_date || "").slice(0, 4),
    score: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
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
    meta: (item.first_air_date || "").slice(0, 4),
    score: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
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
    meta: item.released ? item.released.slice(0, 4) : null,
    score: item.rating ? Number((item.rating * 2).toFixed(1)) : null,
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
      .slice(0, 4)
      .map((item) =>
        item.media_type === "tv" ? formatSeries(item) : formatMovie(item),
      );

    let games = [];
    if (rawgResults.length > 0) {
      const topGames = rawgResults.slice(0, 2);
      const gameDetailsResults = await Promise.allSettled(
        topGames.map((game) => getGameDetails(game.id)),
      );
      games = gameDetailsResults
        .filter((r) => r.status === "fulfilled")
        .map((r) => formatGame(r.value));
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
      .map((show) => {
        const lastEp = show.last_episode_to_air;

        if (!lastEp) return null;

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

export async function getDiscover(req, res) {
  try {
    const {
      types = "movie,series,game",
      genre = "all",
      decade = "all",
      minRating = 0,
      sortBy = "popularity",
      page = 1,
      query = "",
    } = req.query;

    const selectedTypes = types.split(",").filter(Boolean);

    const pageNum = Math.max(1, Number(page));

    const filters = {
      genre,
      decade,
      minRating: Number(minRating) || undefined,
      sortBy,
    };

    const searchQuery = query.trim();

    const results = [];

    //search
    if (searchQuery) {
      if (selectedTypes.includes("movie")) {
        try {
          const raw = await searchMovie(searchQuery);
          results.push(...raw.map(formatMovie));
        } catch (err) {
          console.error("TMDB discover failed:", err.message);
        }
      }

      if (selectedTypes.includes("series")) {
        try {
          const raw = await searchSeries(searchQuery);
          results.push(...raw.map(formatSeries));
        } catch (err) {
          console.error("TMDB discover failed:", err.message);
        }
      }

      if (selectedTypes.includes("game")) {
        try {
          const raw = await discoverGames({
            ...filters,
            page: pageNum,
            pageSize: perType,
          });
          results.push(...raw.map(formatGame));
        } catch (err) {
          console.error("RAWG discover failed:", err.message);
        }
      }

      return res.json({
        page: 1,
        pageSize: results.length,
        results: sortResults(results, sortBy),
        hasMore: false,
      });
    }

    //discover

    const perType = Math.ceil(PAGE_SIZE / selectedTypes.length);

    // movies
    if (selectedTypes.includes("movie")) {
      const startIndex = (pageNum - 1) * perType;

      const startPage = Math.floor(startIndex / TMDB_PAGE_SIZE) + 1;

      const endPage = Math.ceil((startIndex + perType) / TMDB_PAGE_SIZE);

      const raw = await discoverMovies({
        ...filters,
        startPage,
        endPage,
      });

      const offset = startIndex % TMDB_PAGE_SIZE;

      results.push(...raw.slice(offset, offset + perType).map(formatMovie));
    }

    // series
    if (selectedTypes.includes("series")) {
      const startIndex = (pageNum - 1) * perType;

      const startPage = Math.floor(startIndex / TMDB_PAGE_SIZE) + 1;

      const endPage = Math.ceil((startIndex + perType) / TMDB_PAGE_SIZE);

      const raw = await discoverSeries({
        ...filters,
        startPage,
        endPage,
      });

      const offset = startIndex % TMDB_PAGE_SIZE;

      results.push(...raw.slice(offset, offset + perType).map(formatSeries));
    }

    // games
    if (selectedTypes.includes("game")) {
      const raw = await discoverGames({
        ...filters,
        page: pageNum,
        pageSize: perType,
      });

      results.push(...raw.map(formatGame));
    }

    res.json({
      page: pageNum,
      pageSize: PAGE_SIZE,
      results,
      hasMore: results.length >= PAGE_SIZE * 0.5,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Error loading discover results",
    });
  }
}

//sort
function sortResults(items, sortBy) {
  const sorted = [...items];

  switch (sortBy) {
    case "rating":
      return sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    case "release_date":
      return sorted.sort((a, b) => (b.meta || "").localeCompare(a.meta || ""));

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
        score: raw.vote_average ? Number(raw.vote_average.toFixed(1)) : null,
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
        score: raw.vote_average ? Number(raw.vote_average.toFixed(1)) : null,
        genres: raw.genres?.map((g) => g.name) || [],
        cast: raw.cast.map((c) => ({
          name: c.name,
          character: c.character,
          photoUrl: c.profile_path
            ? `https://image.tmdb.org/t/p/w200${c.profile_path}`
            : null,
        })),
        seasons: (raw.seasons || [])
          .filter((s) => s.season_number > 0)
          .map((s) => ({
            seasonNumber: s.season_number,
            name: s.name,
            episodeCount: s.episode_count,
          })),
      };
    } else if (type === "game") {
      const raw = await getGameDetails(id);
      detail = {
        externalId: String(raw.id),
        source: "rawg",
        type: "game",
        title: raw.name,
        overview: raw.description_raw,
        posterUrl: raw.background_image,
        releaseDate: raw.released,
        score: raw.rating ? Number((raw.rating * 2).toFixed(1)) : null,
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
    });

    res.json({ ...detail, mediaId: media.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error loadind media details" });
  }
}
