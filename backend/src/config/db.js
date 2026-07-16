import pkg from 'pg';
const { Pool } = pkg;
export const pools = new Pool({ connectionString: process.env.DATABASE_URL });