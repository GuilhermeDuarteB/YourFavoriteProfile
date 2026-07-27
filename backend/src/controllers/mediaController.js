import {
  getTrendingTmdb,
  getTrendingSeriesWithDetails,
  discoverMovies,
  discoverSeries,
  searchMovie,
  searchSeries,
} from '../services/tmbdService.js';
import { getTrendingRawg, discoverGames, searchRawg } from '../services/rawgService.js';

export async function getTrending(req, res) {
  try {
    const [tmdbResults, rawgResults] = await Promise.all([
      getTrendingTmdb(),
      getTrendingRawg(),
    ]);

    const movies = tmdbResults
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 4)
      .map((item) => ({
        title: item.title || item.name,
        type: item.media_type === 'tv' ? 'series' : 'movie',
        meta: (item.release_date || item.first_air_date || '').slice(0, 4),
        score: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
        posterUrl: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : null,
      }));

    const games = rawgResults.slice(0, 2).map((item) => ({
      title: item.name,
      type: 'game',
      meta: item.released ? item.released.slice(0, 4) : null,
      score: item.rating ? Number(item.rating) : null,
      posterUrl: item.background_image,
    }));

    res.json([...movies, ...games]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading trending media' });
  }
}

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
    res.status(500).json({ error: 'Error loading latest episodes' });
  }
}

function formatMovie(item) {
  return {
    title: item.title,
    type: 'movie',
    meta: (item.release_date || '').slice(0, 4),
    score: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
    posterUrl: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
  };
}

function formatSeries(item) {
  return {
    title: item.name,
    type: 'series',
    meta: (item.first_air_date || '').slice(0, 4),
    score: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
    posterUrl: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
  };
}

function formatGame(item) {
  return {
    title: item.name,
    type: 'game',
    meta: item.released ? item.released.slice(0, 4) : null,
    score: item.rating ? Number(item.rating) : null,
    posterUrl: item.background_image,
  };
}

const PAGE_SIZE = 50;
const TMDB_PAGE_SIZE = 20;

export async function getDiscover(req, res) {
  try {
    const {
      types = 'movie,series,game',
      genre = 'all',
      decade = 'all',
      minRating = 0,
      sortBy = 'popularity',
      page = 1,
      query = '',
    } = req.query;

    const selectedTypes = types.split(',').filter(Boolean);
    const pageNum = Math.max(1, Number(page));
    const filters = { genre, decade, minRating: Number(minRating) || undefined, sortBy };
    const searchQuery = query.trim();

    const results = [];

    if (searchQuery) {
      if (selectedTypes.includes('movie')) {
        const raw = await searchMovie(searchQuery);
        results.push(...raw.map(formatMovie));
      }
      if (selectedTypes.includes('series')) {
        const raw = await searchSeries(searchQuery);
        results.push(...raw.map(formatSeries));
      }
      if (selectedTypes.includes('game')) {
        const raw = await searchRawg(searchQuery);
        results.push(...raw.map(formatGame));
      }

      return res.json({
        page: 1,
        pageSize: results.length,
        results,
        hasMore: false,
      });
    }

    const perType = Math.ceil(PAGE_SIZE / selectedTypes.length);

    if (selectedTypes.includes('movie')) {
      const startIndex = (pageNum - 1) * perType;
      const startPage = Math.floor(startIndex / TMDB_PAGE_SIZE) + 1;
      const endPage = Math.ceil((startIndex + perType) / TMDB_PAGE_SIZE);
      const raw = await discoverMovies({ ...filters, startPage, endPage });
      const offset = startIndex % TMDB_PAGE_SIZE;
      results.push(...raw.slice(offset, offset + perType).map(formatMovie));
    }

    if (selectedTypes.includes('series')) {
      const startIndex = (pageNum - 1) * perType;
      const startPage = Math.floor(startIndex / TMDB_PAGE_SIZE) + 1;
      const endPage = Math.ceil((startIndex + perType) / TMDB_PAGE_SIZE);
      const raw = await discoverSeries({ ...filters, startPage, endPage });
      const offset = startIndex % TMDB_PAGE_SIZE;
      results.push(...raw.slice(offset, offset + perType).map(formatSeries));
    }

    if (selectedTypes.includes('game')) {
      const raw = await discoverGames({ ...filters, page: pageNum, pageSize: perType });
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
    res.status(500).json({ error: 'Error loading discover results' });
  }
}