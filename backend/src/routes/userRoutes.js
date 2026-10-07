import { Router } from 'express';
import { getPublicProfile, searchUsers, updateMyProfile, getUserReviews } from '../controllers/userController.js';
import {authMiddleware} from '../middleware/auth.js';
import { optionalAuth } from "../middleware/optionalAuth.js";

const router = Router();
router.get('/search', searchUsers);
router.get('/:username/reviews', getUserReviews);
router.get('/:username', optionalAuth, getPublicProfile);
router.put('/me', authMiddleware, updateMyProfile);

export default router;
