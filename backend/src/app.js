import express from 'express';
import cors from 'cors';
import { getFrontendOrigin } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js';
import { authLimiter, apiLimiter } from './middleware/rateLimit.js';
import followRoutes from './routes/followRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import topFiveRoutes from './routes/topFiveRoutes.js';

const app = express();
app.use(cors({ origin: getFrontendOrigin() }));
app.use(express.json());

app.use('/api/reviews', reviewRoutes);
app.use('/api/media', apiLimiter, mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/top-five', topFiveRoutes);
export default app;
