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