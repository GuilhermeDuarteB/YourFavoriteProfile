import { Router } from 'express';
import {
  postWatchlist,
  deleteWatchlist,
  getMyWatchlist,
  getWatchlistStatus,
} from '../controllers/watchlistController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, postWatchlist);
router.get('/me', authMiddleware, getMyWatchlist);
router.get('/:mediaId', authMiddleware, getWatchlistStatus);
router.delete('/:mediaId', authMiddleware, deleteWatchlist);

export default router;