import {getTrendingTmdb} from '../services/tmbdService.js';
import {getTrendingRawg} from '../services/rawgService.js';

export async function getTrending(req, res) {
    try{
        const [tmdbResults, rawgResults] = await Promise.all([
            getTrendingTmdb(),
            getTrendingRawg()
        ]);

        const movies = tmdbResults.filter(item => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 4)
        .map(item => ({
            title: item.title || item.name,
            type: item.media_type === 'tv' ? 'series' : 'movie',
            meta: (item.release_date || item.first_air_date || '').slice(0, 4),
            score: item.vote_average?.toFixed(1),
            posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500/${item.poster_path}` : null,
        })
        );

        const games = rawgResults.slice (0, 2).map((item) => ({
            title: item.name,
            type:'game',
            meta: item.released?.slice(0, 4),
            score: item.rating,
            posterUrl: item.background_image,
        }));

        res.json([...movies,...games]);
    }catch (err){
        console.error(err);
        res.status(500).json({error: 'Error loading trending media'});
    }}