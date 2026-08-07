import axios from "axios";

const tmdb = axios.create({
  baseURL: "https://api.themoviedb.org/3",
  params: {
    api_key: process.env.TMDB_API_KEY,
    timeout: 5000,
  },
});

export async function searchTmdb(query) {
  const res = await tmdb.get("/search/multi", {
    params: {
      query,
    },
  });
  return res.data.results;
}

export async function getTrendingTmdb() {
  const res = await tmdb.get("/trending/all/week");
  return res.data.results;
}

export async function getTrendingSeriesWithDetails() {
  const trendingRes = await tmdb.get("/trending/tv/week");
  const topSeries = trendingRes.data.results.slice(0, 4);

  const detailed = await Promise.all(
    topSeries.map((series) => tmdb.get(`/tv/${series.id}`)),
  );

  return detailed.map((res) => res.data);
}

//export tmdb GENRES

export const TMDB_MOVIES_GENRES = {
  action: 28,
  drama: 18,
  comedy: 35,
  scifi: 878,
  horror: 27,
};

export const TMDB_TV_GENRES = {
  action: 10759,
  drama: 18,
  comedy: 35,
  scifi: 10765,
  horror: 9648,
};

function buildDateRange(decade) {
  if (!decade || decade === "all") return {};
  const start = `${decade}-01-01`;
  const endYear = Number(decade) + 9;
  const end = `${endYear}-12-31`;
  return { start, end };
}

function mapSortBy(sortBy, dateField) {
  switch (sortBy) {
    case "rating":
      return "vote_average.desc";
    case "release_date":
      return `${dateField}.desc`;
    case "title":
      return "original_title.asc";
    default:
      return "popularity.desc";
  }
}

async function fetchPages(path, baseParams, startPage, endPage) {
  const pageNumbers = [];
  for (let p = startPage; p <= endPage; p++) pageNumbers.push(p);

  const responses = await Promise.all(
    pageNumbers.map((page) =>
      tmdb.get(path, { params: { ...baseParams, page } }),
    ),
  );

  return responses.flatMap((res) => res.data.results);
}

export async function discoverMovies({
  genre,
  decade,
  minRating,
  sortBy,
  startPage,
  endPage,
}) {
  const { start, end } = buildDateRange(decade);
  const params = {
    with_genres:
      genre && genre !== "all" ? TMDB_MOVIES_GENRES[genre] : undefined,
    "primary_release_date.gte": start,
    "primary_release_date.lte": end,
    "vote_average.gte": minRating || undefined,
    sort_by: mapSortBy(sortBy, "primary_release_date"),
  };
  return fetchPages("/discover/movie", params, startPage, endPage);
}

export async function discoverSeries({
  genre,
  decade,
  minRating,
  sortBy,
  startPage,
  endPage,
}) {
  const { start, end } = buildDateRange(decade);
  const params = {
    with_genres: genre && genre !== "all" ? TMDB_TV_GENRES[genre] : undefined,
    "first_air_date.gte": start,
    "first_air_date.lte": end,
    "vote_average.gte": minRating || undefined,
    sort_by: mapSortBy(sortBy, "first_air_date"),
  };
  return fetchPages("/discover/tv", params, startPage, endPage);
}

export async function searchMovie(query){
    const res = await tmdb.get('/search/movie', {
        params: {query}
    });
    return res.data.results;
}

export async function searchSeries(query) {
  const res = await tmdb.get('/search/tv', { params: { query } });
  return res.data.results;
}

export async function getMovieDetails(id) {
  const [detailsRes, creditsRes] = await Promise.all([
    tmdb.get(`/movie/${id}`),
    tmdb.get(`/movie/${id}/credits`),
  ]);

  return {... detailsRes.data, cast: creditsRes.data.cast?.slice(0,8) || []};
}

export async function getSeriesDetails(id) {
  const [detailsRes, creditsRes] = await Promise.all([
    tmdb.get(`/tv/${id}`),
    tmdb.get(`/tv/${id}/credits`),
  ]);

  return {... detailsRes.data, cast: creditsRes.data.cast?.slice(0,8) || []};
}