import 'dotenv/config';
import app from './src/app.js';
import { pools } from './src/config/db.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    const result = await pools.query('SELECT NOW()');
    console.log('Database connected:', result.rows[0].now);
  } catch (err) {
    console.error('Error connecting to DB:', err.message);
  }
});