import 'dotenv/config';
import { validateEnvironment } from './src/config/env.js';

let pool;
try {
  const { port } = validateEnvironment();
  const { pools } = await import('./src/config/db.js');
  pool = pools;
  try {
    await pool.query('SELECT 1');
  } catch {
    throw new Error('Database connection failed; check database availability and configuration');
  }
  const { default: app } = await import('./src/app.js');
  try {
    await new Promise((resolve, reject) => {
      const server = app.listen(port, resolve);
      server.once('error', reject);
    });
  } catch {
    throw new Error('HTTP server failed to listen; check PORT and whether it is already in use');
  }
  console.log(`Server running on port ${port}`);
} catch (err) {
  console.error('Startup failed:', err.message);
  process.exitCode = 1;
  if (pool) await pool.end();
}
