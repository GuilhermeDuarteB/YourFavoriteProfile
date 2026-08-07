import { Router } from 'express';
import { getPublicProfile, searchUsers, updateMyProfile } from '../controllers/userController.js';
import {authMiddleware} from '../middleware/auth.js';

const router = Router();
router.get('/search', searchUsers);
router.get('/:username', getPublicProfile);
router.put('/me', authMiddleware, updateMyProfile);

export default router;