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