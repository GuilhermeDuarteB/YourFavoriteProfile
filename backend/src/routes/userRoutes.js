import { Router } from 'express';
import { getPublicProfile, searchUsers } from '../controllers/userController.js';

const router = Router();
router.get('/search', searchUsers);
router.get('/:username', getPublicProfile);

export default router;