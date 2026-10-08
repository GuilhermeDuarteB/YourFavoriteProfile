import { Router } from 'express';
import { getPublicProfile, searchUsers, updateMyProfile, getUserReviews } from '../controllers/userController.js';
import {authMiddleware} from '../middleware/auth.js';
import { optionalAuth } from "../middleware/optionalAuth.js";
import { getFollowers, getFollowing } from "../controllers/followListController.js";

const router = Router();
router.get('/search', searchUsers);
router.get('/:username/followers', getFollowers);
router.get('/:username/following', getFollowing);
router.get('/:username/reviews', getUserReviews);
router.get('/:username', optionalAuth, getPublicProfile);
router.put('/me', authMiddleware, updateMyProfile);

export default router;
