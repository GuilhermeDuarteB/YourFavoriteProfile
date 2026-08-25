import {Router} from 'express';
import {postFollow, deleteFollow} from '../controllers/followController.js';
import {authMiddleware} from '../middleware/auth.js';

const router = Router();

router.post('/:username', authMiddleware, postFollow);
router.delete('/:username', authMiddleware, deleteFollow);

export default router;