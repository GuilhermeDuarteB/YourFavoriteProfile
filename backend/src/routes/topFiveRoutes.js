import { Router } from 'express';
import { putTopFive, getTopFiveForUsername } from '../controllers/topFiveController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.put('/', authMiddleware, putTopFive);
router.get('/:username', getTopFiveForUsername);

export default router;