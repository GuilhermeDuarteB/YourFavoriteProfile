import {Router} from 'express';
import { register, login, updateEmail, deleteAccount } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.put('/me/email', authMiddleware, updateEmail);
router.delete('/me', authMiddleware, deleteAccount);

export default router;