import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { TABLES, VIEWS, verifyBaseline } from "./schema.js";
import { preflight } from "./preflight.js";

export const migrationDirectory = new URL("./migrations/", import.meta.url);
const signaturePath = new URL("./baseline-signature.json", import.meta.url);
const LOCK_KEY = 846192507;

export async function readMigrations(directory = migrationDirectory) {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const versions = new Set();
  const migrations = [];
  for (const filename of files) {
    const match = /^(\d{3})_[a-z0-9_]+\.sql$/.exec(filename);
    if (!match) throw new Error("Invalid migration filename: " + filename);
    const version = Number(match[1]);
    if (versions.has(version))
      throw new Error("Duplicate migration version: " + version);
    versions.add(version);
    const sql = (await readFile(new URL(filename, directory), "utf8")).replace(
      /\r\n/g,
      "\n",
    );
    migrations.push({
      version,
      filename,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  if (migrations[0]?.filename !== "001_baseline.sql")
    throw new Error("001_baseline.sql is required");
  return migrations.sort((a, b) => a.version - b.version);
}

// One checked-out client and one transaction for the whole pending batch.
// Status also takes the lock but makes no persistent database writes.
export async function migrate(
  pool,
  { status = false, directory = migrationDirectory, log = console.log } = {},
) {
  const migrations = await readMigrations(directory);
  const client = await pool.connect();
  try {
    await client.query(status ? "BEGIN READ ONLY" : "BEGIN");
    await client.query("SET LOCAL search_path = public, pg_catalog");
    await client.query("SET LOCAL lock_timeout = '10s'");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock($1) AS acquired",
      [LOCK_KEY],
    );
    if (!lock.rows[0].acquired)
      throw new Error("Another migration runner holds the advisory lock");
    const historyExists = (
      await client.query(
        "SELECT to_regclass('public.schema_migrations') AS name",
      )
    ).rows[0].name;
    const history = historyExists
      ? (
          await client.query(
            "SELECT version,filename,checksum FROM public.schema_migrations ORDER BY version",
          )
        ).rows
      : [];
    for (const [index, applied] of history.entries()) {
      const file = migrations[index];
      if (
        !file ||
        file.version !== applied.version ||
        file.filename !== applied.filename ||
        file.checksum !== applied.checksum
      ) {
        throw new Error(
          "Migration history mismatch at version " +
            applied.version +
            ": missing, reordered or modified migration",
        );
      }
    }
    const pending = migrations.slice(history.length);
    let adoption = false;
    if (!history.length) {
      const objects = (
        await client.query(`
        SELECT relname,relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','v','m','p','f')
        AND c.relname<>'schema_migrations'`)
      ).rows;
      if (objects.length) {
        const expectedObjects = [...TABLES, ...VIEWS].sort();
        if (
          JSON.stringify(objects.map((o) => o.relname).sort()) !==
          JSON.stringify(expectedObjects)
        ) {
          throw new Error(
            "Baseline adoption refused: public tables/views are incomplete or unexpected",
          );
        }
        // Lock before verification and preflight; concurrent writes cannot invalidate the checks.
        if (!status)
          await client.query(
            "LOCK TABLE " +
              TABLES.map((t) => "public." + t).join(",") +
              " IN ACCESS EXCLUSIVE MODE",
          );
        await verifyBaseline(
          client,
          JSON.parse(await readFile(signaturePath, "utf8")),
        );
        adoption = true;
      }
    } else if (pending.length && !status) {
      await client.query(
        "LOCK TABLE " +
          TABLES.map((t) => "public." + t).join(",") +
          " IN ACCESS EXCLUSIVE MODE",
      );
    }
    if (adoption || history.length) await preflight(client);
    for (const migration of migrations) {
      log(
        migration.filename +
          ": " +
          (history.some((row) => row.version === migration.version)
            ? "applied"
            : adoption && migration.version === 1
              ? "pending (verified baseline adoption)"
              : "pending"),
      );
    }
    if (!status && pending.length) {
      await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version integer PRIMARY KEY, filename text NOT NULL UNIQUE,
        checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      for (const migration of pending) {
        if (!(adoption && migration.version === 1))
          await client.query(migration.sql);
        await client.query(
          "INSERT INTO public.schema_migrations (version,filename,checksum) VALUES ($1,$2,$3)",
          [migration.version, migration.filename, migration.checksum],
        );
        log(
          (adoption && migration.version === 1 ? "Adopting " : "Applying ") +
            migration.filename,
        );
      }
    }
    await client.query("COMMIT");
    if (!status && pending.length)
      log("Migration batch committed successfully");
    return { applied: history.length, pending: pending.length, adoption };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
