import "dotenv/config";
import pg from "pg";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createTestDatabase } from "../db/testDatabase.js";
import { backupSnapshot, verifyBackup } from "../db/backupVerification.js";
import { preflight } from "../db/preflight.js";

// pg_dump/pg_restore must be on PATH (or set PG_BIN to their directory).
// The only restore target is a newly created, randomly named test database.
let pool, client, restored;
try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  client = await pool.connect();
  const params = client.connectionParameters;
  const env = {
    ...process.env,
    PGHOST: params.host,
    PGPORT: String(params.port),
    PGUSER: params.user,
    PGPASSWORD: params.password || "",
    PGDATABASE: params.database,
    PGCONNECT_TIMEOUT: "5",
  };
  // Do not guess how to translate custom TLS/connection options into libpq.
  const url = new URL(process.env.DATABASE_URL);
  if (params.ssl || url.search)
    throw new Error(
      "Backup helper supports plain local connections only; use pg_dump with your deployment's TLS settings",
    );
  function run(tool, args, database = params.database) {
    const command = process.env.PG_BIN ? join(process.env.PG_BIN, tool) : tool;
    const result = spawnSync(command, args, {
      env: { ...env, PGDATABASE: database },
      encoding: "utf8",
      timeout: 120000,
    });
    if (result.error || result.status !== 0)
      throw new Error(
        tool +
          " failed; verify PostgreSQL tools, connection and permissions (exit " +
          result.status +
          ")",
      );
    return result.stdout;
  }
  run("pg_dump", ["--version"]);
  run("pg_restore", ["--version"]);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  await client.query("SET LOCAL search_path TO public, pg_catalog");
  await preflight(client);
  const snapshot = await backupSnapshot(client);
  const exported = (await client.query("SELECT pg_export_snapshot() AS id"))
    .rows[0].id;
  const directory = fileURLToPath(new URL("../../.backups/", import.meta.url));
  await mkdir(directory, { recursive: true });
  const filename =
    "yfp-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    "-" +
    randomBytes(4).toString("hex") +
    ".dump";
  const path = join(directory, filename);
  run("pg_dump", [
    "--no-password",
    "--format=custom",
    "--snapshot=" + exported,
    "--file=" + path,
  ]);
  await client.query("COMMIT");
  run("pg_restore", ["--list", path]);
  restored = await createTestDatabase(process.env.DATABASE_URL);
  run(
    "pg_restore",
    ["--no-password", "--exit-on-error", "--dbname=" + restored.name, path],
    restored.name,
  );
  const verification = await restored.pool.connect();
  try {
    await verifyBackup(verification, snapshot);
  } finally {
    verification.release();
  }
  const sha256 = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
  const report = {
    database: params.database,
    filename,
    sha256,
    verifiedAt: new Date().toISOString(),
    snapshot,
  };
  await writeFile(
    path + ".verified.json",
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log("Backup verified by restoring to a disposable database:", path);
  console.log("SHA-256:", sha256);
  console.log(
    "Row counts:",
    Object.fromEntries(
      Object.entries(snapshot.tables).map(([name, value]) => [
        name,
        value.count,
      ]),
    ),
  );
} catch (error) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  // Restore assertions contain row/view data; never print the assertion payload.
  console.error(
    "Backup failed:",
    error.code === "ERR_ASSERTION"
      ? error.message.split("\n")[0]
      : error.code || error.message,
  );
  process.exitCode = 1;
} finally {
  if (client) client.release();
  if (pool) await pool.end();
  if (restored) await restored.dispose();
}
