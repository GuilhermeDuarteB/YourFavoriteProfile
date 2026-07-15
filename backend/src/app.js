import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// rotas vão aqui depois: app.use('/api/auth', authRoutes);

export default app;