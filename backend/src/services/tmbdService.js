import axios from 'axios';

const tmdb = axios.create({
    baseURL: 'https://api.themoviedb.org/3',
    params: {
        api_key: process.env.TMDB_API_KEY,
    },
})

export async function searchTmdb(query) {
    const res = await tmdb.get('/search/multi', {
        params: {
            query
        }
    });
    return res.data.results;
}

export async function getTrendingTmdb() {
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
}

function DateRange(decade) {
    if (!decade || decade === 'all') return {};
    const start = `${decade}-01-01`;
    const endYear = Number(decade) + 9;
    const end = `${endYear}-12-31`;
    return { start, end };
}

function mapSortBy(sortBy, dateField) {
    switch (sortBy) {
        case 'rating':
            return 'vote_average.desc';
        case 'release_date':
            return `${dateField}.desc`;
        case 'title':
            return 'original_title.asc'
        default:
            return 'popularity.desc';
    }
}