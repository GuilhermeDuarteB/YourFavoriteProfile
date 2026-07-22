import {Router} from 'express';
import { getTrending } from '../controllers/mediaController.js';

const router = Router();

router.get('/trending', getTrending);

export default router;