import {getTrendingTmdb, getTrendingSeriesWithDetails} from '../services/tmbdService.js';
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
            type: item.media_type === 'tv' ? 'Series' : 'Movie',
            meta: (item.release_date || item.first_air_date || '').slice(0, 4),
            score: item.vote_average?.toFixed(1),
            posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500/${item.poster_path}` : null,
        })
        );

        const games = rawgResults.slice (0, 2).map((item) => ({
            title: item.name,
            type:'Game',
            meta: item.released?.slice(0, 4),
            score: item.rating,
            posterUrl: item.background_image,
        }));

        res.json([...movies,...games]);
    }catch (err){
        console.error(err);
        res.status(500).json({error: 'Error loading trending media'});
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
            ? `https://image.tmdb.org/t/p/w200${show.poster_path}`
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