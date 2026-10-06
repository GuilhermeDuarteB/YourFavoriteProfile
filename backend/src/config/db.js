import pkg from 'pg';
const { Pool } = pkg;
export const pools = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
pools.on('error', () => console.error('Unexpected idle database connection error'));
