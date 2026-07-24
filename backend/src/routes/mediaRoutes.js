import {Router} from 'express';
import { getTrending, getLatestEpisodes } from '../controllers/mediaController.js';

const router = Router();

router.get('/trending', getTrending);
router.get('/latest-episodes', getLatestEpisodes)

export default router;