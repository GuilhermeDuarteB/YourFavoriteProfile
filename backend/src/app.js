import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import mediaRoutes from './routes/mediaRoutes.js'
import reviewRoutes from './routes/reviewRoutes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/reviews', reviewRoutes);
app.use('/api/media', mediaRoutes)
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
export default app;