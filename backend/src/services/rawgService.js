import axios from 'axios';

const rawg = axios.create({
    baseURL: 'https://api.rawg.io/api',
    params: {
        key: process.env.RAWG_API_KEY,
    },
})

export async function searchRawg(query){
    const res = await rawg.get('/games', {
        params: {
            search: query}
    });
    return res.data.results;
}

export async function getTrendingRawg(){
    const res = await rawg.get('/games', {
        params: {
            ordering : '-added'
        }
    });
    return res.data.results;
}


//slug to dont coincide with tmbd
const RAWG_GENRE_SLUGS = {
    action: 'action',
};

function mapRawgSort(sortBy){
    switch(sortBy){
        case 'rating':
            return '-rating';
        case 'release_date':
            return '-released';
        case 'title':
            return 'name';
        default:
            return '-added'; //popularity proxy
    }
}

export async function discoverGames({genre, decade, minRating, sortBy, page, pageSize}){
    const params = {
        genres: genre && genre !== 'all' ? RAWG_GENRE_SLUGS[genre] : undefined,
        dates: decade && decade !== 'all' ? `${decade}-01-01, ${Number(decade) + 9}-12-31` : undefined,
        ordering: mapRawgSort(sortBy), page,
        page_size: pageSize,
    };
    const res = await rawg.get('/games', {params});
    const filtered = minRating
    ? res.data.results.filter((g) => g.rating >= minRating) : res.data.results;
    return filtered;
}