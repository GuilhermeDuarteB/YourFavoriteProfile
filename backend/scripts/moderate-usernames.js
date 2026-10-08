import "dotenv/config";
import pg from "pg";
import { moderateUsernames } from "../src/utils/usernameMaintenance.js";

let pool;
try {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    args.some((arg) => !["--dry-run", "--apply"].includes(arg))
  ) {
    throw new Error("Usage: yarn users:moderate [--dry-run | --apply]");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required");
  }
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL must be a PostgreSQL URL");
  }
  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  };
  if (url.searchParams.get("sslmode") === "require") poolConfig.ssl = {};
  pool = new pg.Pool(poolConfig);
  const apply = args.includes("--apply");
  const changes = await moderateUsernames(pool, { apply });
  console.log(
    apply ? "Username changes applied:" : "Dry-run proposed changes:",
  );
  // Never print previous usernames, emails, credentials or database row details.
  console.log(JSON.stringify(changes, null, 2));
} catch (error) {
  console.error(
    "Username maintenance failed:",
    error.code
      ? "Database error " + error.code
      : "Check arguments, DATABASE_URL and database access",
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
