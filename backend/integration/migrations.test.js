import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { migrate, migrationDirectory } from "../db/migrate.js";
import { createTestDatabase } from "../db/testDatabase.js";
import { schemaSignature, TABLES } from "../db/schema.js";

const adminUrl = process.env.TEST_DATABASE_URL;
assert.ok(
  adminUrl,
  "TEST_DATABASE_URL is required; integration tests never silently skip",
);
// Application queries below are routed to a newly created test pool, never the admin DB.
process.env.DATABASE_URL = "postgresql://127.0.0.1/unused_test_pool";
const { pools } = await import("../src/config/db.js");
const { findOrCreateMedia } = await import("../src/models/mediaModel.js");
const { postReview } = await import("../src/controllers/reviewController.js");
const { register, updateEmail } =
  await import("../src/controllers/authController.js");
const baseline = await readFile(
  new URL("001_baseline.sql", migrationDirectory),
  "utf8",
);
const canonical = await readFile(
  new URL("../../YFP-Db.sql", import.meta.url),
  "utf8",
);
const quiet = { log() {} };
const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
test.after(() => pools.end());

async function snapshot(pool) {
  const rows = {};
  for (const table of TABLES)
    rows[table] = (
      await pool.query("SELECT * FROM public." + table + " ORDER BY id")
    ).rows;
  return rows;
}

test("empty database migrates, records checksums, reruns safely, and matches canonical schema", async () => {
  const db = await createTestDatabase(adminUrl);
  const reference = await createTestDatabase(adminUrl);
  try {
    await migrate(db.pool, { ...quiet, status: true });
    assert.equal(
      (await db.pool.query("SELECT to_regclass('schema_migrations') AS name"))
        .rows[0].name,
      null,
    );
    await migrate(db.pool, quiet);
    const history = (
      await db.pool.query("SELECT * FROM schema_migrations ORDER BY version")
    ).rows;
    assert.deepEqual(
      history.map((row) => row.version),
      [1, 2, 3, 4, 5, 6],
    );
    assert.ok(
      history.every(
        (row) => /^[a-f0-9]{64}$/.test(row.checksum) && row.applied_at,
      ),
    );
    await migrate(db.pool, quiet);
    assert.deepEqual(
      (await db.pool.query("SELECT * FROM schema_migrations ORDER BY version"))
        .rows,
      history,
    );
    await reference.pool.query(canonical);
    assert.deepEqual(
      await schemaSignature(db.pool),
      await schemaSignature(reference.pool),
    );
    await db.pool.query("SELECT * FROM vw_media_rating");
    await db.pool.query("SELECT * FROM vw_series_rating");
  } finally {
    await db.dispose();
    await reference.dispose();
  }
});

test("historical baseline is adopted without replacing any rows, IDs or relationships", async () => {
  const db = await createTestDatabase(adminUrl);
  try {
    await db.pool.query(baseline);
    // Reparse like pg_dump/restore: PostgreSQL can move equivalent array casts.
    const view = (
      await db.pool.query(
        "SELECT pg_get_viewdef('vw_media_rating'::regclass, true) AS sql",
      )
    ).rows[0].sql;
    await db.pool.query("CREATE OR REPLACE VIEW vw_media_rating AS " + view);
    await db.pool.query(`
      INSERT INTO users(id,username,email,password_hash) VALUES (42,'existing','existing@example.com','test');
      INSERT INTO media(id,external_id,source,type,title) VALUES (51,'99','tmdb','series','Existing series');
      INSERT INTO seasons(id,media_id,season_number) VALUES (61,51,1);
      INSERT INTO episodes(id,season_id,episode_number) VALUES (71,61,1);
      INSERT INTO reviews(id,user_id,episode_id,score) VALUES (81,42,71,8.5);
      INSERT INTO watchlist(user_id,media_id) VALUES (42,51);
      INSERT INTO top_five(user_id,media_id,rank) VALUES (42,51,1);
    `);
    const before = await snapshot(db.pool);
    const result = await migrate(db.pool, quiet);
    assert.equal(result.adoption, true);
    assert.deepEqual(await snapshot(db.pool), before);
    assert.equal(
      (await db.pool.query("SELECT series_score FROM vw_series_rating")).rows[0]
        .series_score,
      "8.5000000000000000",
    );
  } finally {
    await db.dispose();
  }
});

test("incompatible baselines and preflight violations stop before any migration history is written", async () => {
  const db = await createTestDatabase(adminUrl);
  try {
    await db.pool.query(baseline);
    await db.pool.query("ALTER TABLE media ALTER COLUMN title DROP NOT NULL");
    await assert.rejects(migrate(db.pool, quiet), /Baseline adoption refused/);
    await db.pool.query("ALTER TABLE media ALTER COLUMN title SET NOT NULL");
    await db.pool.query(
      "INSERT INTO media(external_id,source,type,title) VALUES ('1','wrong','movie','Invalid')",
    );
    await assert.rejects(migrate(db.pool, quiet), /Preflight failed/);
    assert.equal(
      (await db.pool.query("SELECT to_regclass('schema_migrations') AS name"))
        .rows[0].name,
      null,
    );
    assert.equal(
      (await db.pool.query("SELECT source FROM media")).rows[0].source,
      "wrong",
    );
  } finally {
    await db.dispose();
  }
});

test("checksum changes, duplicate versions, failed SQL and concurrent runners are rejected", async () => {
  const db = await createTestDatabase(adminUrl);
  const temp = await mkdtemp(join(tmpdir(), "yfp-migrations-"));
  const directory = pathToFileURL(temp + "/");
  let lockClient;
  try {
    await cp(migrationDirectory, temp, { recursive: true });
    await writeFile(
      join(temp, "007_failure.sql"),
      "CREATE TABLE rollback_probe(id integer); SELECT missing_column FROM users;",
    );
    await assert.rejects(migrate(db.pool, { ...quiet, directory }));
    assert.equal(
      (await db.pool.query("SELECT to_regclass('users') AS name")).rows[0].name,
      null,
    );
    assert.equal(
      (await db.pool.query("SELECT to_regclass('rollback_probe') AS name"))
        .rows[0].name,
      null,
    );
    await rm(join(temp, "007_failure.sql"));
    await migrate(db.pool, { ...quiet, directory });
    await writeFile(
      join(temp, "002_value_domains.sql"),
      "-- edited applied migration",
    );
    await assert.rejects(
      migrate(db.pool, { ...quiet, directory }),
      /history mismatch/,
    );
    await writeFile(join(temp, "002_duplicate.sql"), "SELECT 1;");
    await assert.rejects(
      migrate(db.pool, { ...quiet, directory }),
      /Duplicate migration version/,
    );
    lockClient = await db.pool.connect();
    await lockClient.query("BEGIN");
    await lockClient.query("SELECT pg_advisory_xact_lock(846192507)");
    await assert.rejects(migrate(db.pool, quiet), /advisory lock/);
  } finally {
    if (lockClient) {
      await lockClient.query("ROLLBACK");
      lockClient.release();
    }
    await db.dispose();
    await rm(temp, { recursive: true });
  }
});

test("real PostgreSQL enforces domains, typed media identity, enrichment and concurrent review uniqueness", async () => {
  const db = await createTestDatabase(adminUrl);
  const originalQuery = pools.query;
  try {
    await migrate(db.pool, quiet);
    pools.query = db.pool.query.bind(db.pool);
    const input = {
      externalId: "99",
      source: "tmdb",
      type: "movie",
      title: "Movie",
      genres: [],
    };
    const movies = await Promise.all(
      Array.from({ length: 8 }, () => findOrCreateMedia(input)),
    );
    assert.equal(new Set(movies.map((row) => row.id)).size, 1);
    const movie = movies[0];
    const series = await findOrCreateMedia({
      ...input,
      type: "series",
      title: "Series",
      genres: ["Drama"],
    });
    assert.notEqual(movie.id, series.id);
    const enriched = await findOrCreateMedia({
      ...input,
      title: "Do not overwrite",
      genres: ["Action"],
    });
    assert.equal(enriched.id, movie.id);
    assert.equal(enriched.title, "Movie");
    assert.deepEqual(enriched.genres, ["Action"]);
    assert.deepEqual(
      (await findOrCreateMedia({ ...input, genres: ["Comedy"] })).genres,
      ["Action"],
    );
    assert.deepEqual(
      (await db.pool.query("SELECT genres FROM media WHERE id=$1", [series.id]))
        .rows[0].genres,
      ["Drama"],
    );
    const user = (
      await db.pool.query(
        "INSERT INTO users(username,email,password_hash) VALUES ('alice','Alice@example.com','test') RETURNING id",
      )
    ).rows[0];
    await assert.rejects(
      db.pool.query(
        "INSERT INTO users(username,email,password_hash) VALUES ('bob',' alice@EXAMPLE.com ','test')",
      ),
      (err) =>
        err.code === "23505" &&
        err.constraint === "users_email_normalized_unique",
    );
    for (const [source, type, externalId, constraint] of [
      ["other", "movie", "1", "media_source_check"],
      ["tmdb", "other", "1", "media_type_check"],
      ["rawg", "movie", "1", "media_source_type_check"],
      ["tmdb", "movie", "  ", "media_external_id_nonblank_check"],
    ]) {
      await assert.rejects(
        db.pool.query(
          "INSERT INTO media(source,type,external_id,title) VALUES ($1,$2,$3,'Invalid')",
          [source, type, externalId],
        ),
        (err) => err.code === "23514",
      ); // Multiple domain checks may reject the same invalid row.
    }
    await assert.rejects(
      db.pool.query(
        "INSERT INTO watchlist(user_id,media_id,status) VALUES ($1,$2,'invalid')",
        [user.id, movie.id],
      ),
      (err) =>
        err.code === "23514" && err.constraint === "watchlist_status_check",
    );
    for (const score of [0, -1, 10.1]) {
      await assert.rejects(
        db.pool.query(
          "INSERT INTO reviews(user_id,media_id,score) VALUES ($1,$2,$3)",
          [user.id, movie.id, score],
        ),
        (err) =>
          err.code === "23514" &&
          err.constraint === "reviews_positive_score_check",
      );
    }
    const season = (
      await db.pool.query(
        "INSERT INTO seasons(media_id,season_number) VALUES ($1,1) RETURNING id",
        [series.id],
      )
    ).rows[0];
    const episode = (
      await db.pool.query(
        "INSERT INTO episodes(season_id,episode_number) VALUES ($1,1) RETURNING id",
        [season.id],
      )
    ).rows[0];
    for (const target of [{ mediaId: movie.id }, { episodeId: episode.id }]) {
      // Both real prechecks finish before either insert, forcing the race path.
      let arrived = 0,
        release;
      const barrier = new Promise((resolve) => {
        release = resolve;
      });
      pools.query = async (sql, values) => {
        const result = await db.pool.query(sql, values);
        if (
          sql.includes("SELECT") &&
          sql.includes("FROM reviews") &&
          sql.includes("user_id = $1")
        ) {
          if (++arrived === 2) release();
          await barrier;
        }
        return result;
      };
      const responses = [response(), response()];
      await Promise.all(
        responses.map((res) =>
          postReview({ userId: user.id, body: { ...target, score: 8.5 } }, res),
        ),
      );
      assert.deepEqual(
        responses.map((res) => res.statusCode).sort(),
        [201, 409],
      );
      assert.match(
        responses.find((res) => res.statusCode === 409).body.error,
        /already reviewed/,
      );
      const column = target.mediaId ? "media_id" : "episode_id";
      assert.equal(
        (
          await db.pool.query(
            "SELECT COUNT(*)::int AS count FROM reviews WHERE user_id=$1 AND " +
              column +
              "=$2",
            [user.id, target.mediaId || target.episodeId],
          )
        ).rows[0].count,
        1,
      );
    }
    pools.query = db.pool.query.bind(db.pool);
    await db.pool.query("UPDATE reviews SET score=10 WHERE media_id=$1", [
      movie.id,
    ]);
    assert.equal(
      Number(
        (
          await db.pool.query(
            "SELECT series_score FROM vw_series_rating WHERE media_id=$1",
            [series.id],
          )
        ).rows[0].series_score,
      ),
      8.5,
    );
  } finally {
    pools.query = originalQuery;
    await db.dispose();
  }
});

test("concurrent registrations and email updates retain friendly conflict responses", async () => {
  const db = await createTestDatabase(adminUrl);
  const originalQuery = pools.query;
  process.env.JWT_SECRET = "integration-test-only";
  try {
    await migrate(db.pool, quiet);
    pools.query = db.pool.query.bind(db.pool);
    const responses = [response(), response()];
    await Promise.all(
      responses.map((res, i) =>
        register(
          {
            body: {
              username: "user" + i,
              email: i ? " SHARED@EXAMPLE.COM " : "shared@example.com",
              password: "password123",
            },
          },
          res,
        ),
      ),
    );
    assert.deepEqual(responses.map((res) => res.statusCode).sort(), [201, 409]);
    assert.equal(
      responses.find((res) => res.statusCode === 409).body.error,
      "Email already in use",
    );
    const created = response();
    await register(
      {
        body: {
          username: "another",
          email: "other@example.com",
          password: "password123",
        },
      },
      created,
    );
    const ids = [
      responses.find((res) => res.statusCode === 201).body.user.id,
      created.body.user.id,
    ];
    const updates = [response(), response()];
    await Promise.all(
      updates.map((res, i) =>
        updateEmail(
          {
            userId: ids[i],
            body: { newEmail: "new@example.com", password: "password123" },
          },
          res,
        ),
      ),
    );
    assert.deepEqual(updates.map((res) => res.statusCode).sort(), [200, 409]);
    assert.equal(
      updates.find((res) => res.statusCode === 409).body.error,
      "Email already in use",
    );
  } finally {
    pools.query = originalQuery;
    await db.dispose();
  }
});
