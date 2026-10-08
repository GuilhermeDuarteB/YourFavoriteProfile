import "dotenv/config";
import pg from "pg";
import { migrate } from "../db/migrate.js";

let pool;
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--status", "--dry-run"].includes(arg)))
    throw new Error("Usage: yarn db:migrate [--dry-run] or yarn db:status");
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("DATABASE_URL is required");
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  };
  if (url.searchParams.get("sslmode") === "require") poolConfig.ssl = {};
  pool = new pg.Pool(poolConfig);
  await migrate(pool, {
    status: args.includes("--status") || args.includes("--dry-run"),
  });
} catch (error) {
  // PostgreSQL details can contain row data. Do not print detail or connection strings.
  console.error(
    "Migration failed:",
    error.code ? "PostgreSQL error " + error.code : error.message,
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
