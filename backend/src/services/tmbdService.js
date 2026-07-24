import axios from 'axios';

const tmdb = axios.create({
    baseURL: 'https://api.themoviedb.org/3',
    params: {
        api_key: process.env.TMDB_API_KEY,
    },
})

export async function searchTmdb(query){
    const res = await tmdb.get('/search/multi', {
        params: {
            query}
    });
    return res.data.results;
}

export async function getTrendingTmdb(){
    const res = await tmdb.get('/trending/all/week');
    return res.data.results;
}

export async function getTrendingSeriesWithDetails() {
  const trendingRes = await tmdb.get('/trending/tv/week');
  const topSeries = trendingRes.data.results.slice(0, 4);

  const detailed = await Promise.all(
    topSeries.map((series) => tmdb.get(`/tv/${series.id}`))
  );

  return detailed.map((res) => res.data);
}