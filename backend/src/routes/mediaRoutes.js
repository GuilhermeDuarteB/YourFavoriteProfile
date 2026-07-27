import {Router} from 'express';
import { getTrending, getLatestEpisodes, getDiscover } from '../controllers/mediaController.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/latest-episodes', getLatestEpisodes);
router.get('/discover', getDiscover);

export default router;