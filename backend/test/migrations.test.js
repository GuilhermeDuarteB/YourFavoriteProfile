import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readMigrations } from "../db/migrate.js";
import { preflight, CHECKS } from "../db/preflight.js";

test("migration files have ordered distinct versions and SHA-256 checksums", async () => {
  const migrations = await readMigrations();
  assert.deepEqual(
    migrations.map(({ version }) => version),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.ok(
    migrations.every(({ checksum }) => /^[a-f0-9]{64}$/.test(checksum)),
  );
});

test("preflight runs every check and reports violation counts without row values", async () => {
  for (const failing of [null, ...Object.keys(CHECKS)]) {
    const calls = [];
    const client = {
      query: async (sql) => {
        calls.push(sql);
        return {
          rows: [{ count: failing && sql.includes(CHECKS[failing]) ? 1 : 0 }],
        };
      },
    };
    if (failing)
      await assert.rejects(preflight(client), new RegExp(failing + "=1"));
    else
      assert.ok(
        Object.values(await preflight(client)).every((count) => count === 0),
      );
    assert.equal(calls.length, Object.keys(CHECKS).length);
  }
});

test("migration CLI requires only DATABASE_URL and rejects missing/malformed configuration safely", () => {
  for (const url of ["", "not-a-url", "https://example.com/private"]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/migrate.js", "--status"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          DOTENV_CONFIG_PATH: "missing-test-env",
          DATABASE_URL: url,
          JWT_SECRET: "",
          TMDB_API_KEY: "",
          RAWG_API_KEY: "",
          FRONTEND_URL: "",
        },
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /DATABASE_URL/);
    assert.doesNotMatch(
      result.stderr,
      /JWT_SECRET|TMDB_API_KEY|RAWG_API_KEY|example.com|not-a-url/,
    );
  }
});
