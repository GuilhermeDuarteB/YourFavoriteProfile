import "dotenv/config";
import { spawnSync } from "node:child_process";

// Explicit opt-in to the current server. Tests always create their own databases.
if (process.argv.includes("--local"))
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
if (!process.env.TEST_DATABASE_URL) {
  console.error(
    "Set TEST_DATABASE_URL to a PostgreSQL admin connection, or use yarn test:db --local.",
  );
  process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    ["--test", "integration/*.test.js"],
    { stdio: "inherit", env: process.env },
  );
  process.exitCode = result.status ?? 1;
}
