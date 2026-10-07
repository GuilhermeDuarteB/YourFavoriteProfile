import {Router} from 'express';
import { getTrending, getLatestEpisodes, getDiscover, getMediaDetails, getSeasonEpisodes } from '../controllers/mediaController.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/latest-episodes', getLatestEpisodes);
router.get('/discover', getDiscover);
router.get('/series/:id/season/:seasonNumber', getSeasonEpisodes);
router.get('/:type/:id', getMediaDetails)

export default router;
