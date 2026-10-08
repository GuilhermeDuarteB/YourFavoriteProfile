import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { migrate, migrationDirectory, readMigrations } from "../db/migrate.js";
import { createTestDatabase } from "../db/testDatabase.js";
import { databaseSnapshot } from "../db/snapshot.js";

const adminUrl = process.env.TEST_DATABASE_URL;
assert.ok(adminUrl, "TEST_DATABASE_URL is required");
process.env.DATABASE_URL = "postgresql://127.0.0.1/unused_test_pool";
process.env.JWT_SECRET = "username-integration-only";
const { pools } = await import("../src/config/db.js");
const { register, updateUsernameHandler } =
  await import("../src/controllers/authController.js");
const { findUserByUsername } = await import("../src/models/userModel.js");
const { getPublicProfile, getUserReviews, searchUsers } =
  await import("../src/controllers/userController.js");
const { postFollow, deleteFollow } =
  await import("../src/controllers/followController.js");
const { getTopFiveForUsername } =
  await import("../src/controllers/topFiveController.js");
const { getMyWatchlist } =
  await import("../src/controllers/watchlistController.js");
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

async function createAccount(username, email) {
  const res = response();
  await register({ body: { username, email, password: "password123" } }, res);
  assert.equal(res.statusCode, 201);
  return res.body.user;
}

// Real SELECTs complete before either contender is allowed to INSERT/UPDATE.
function raceUsernamePrechecks(pool) {
  let arrivals = 0,
    release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  pools.query = async (sql, values) => {
    const result = await pool.query(sql, values);
    if (sql.includes("FROM users WHERE LOWER(username)")) {
      if (++arrivals === 2) release();
      await barrier;
    }
    return result;
  };
}

test(
  "007 upgrades existing migration history without altering data; collisions block it atomically",
  { timeout: 30000 },
  async () => {
    const temp = await mkdtemp(join(tmpdir(), "yfp-username-migrations-"));
    const directory = pathToFileURL(temp + "/");
    try {
      for (const file of (await readMigrations()).filter(
        (file) => file.version <= 6,
      )) {
        await copyFile(
          new URL(file.filename, migrationDirectory),
          join(temp, file.filename),
        );
      }
      for (const collision of [false, true]) {
        const db = await createTestDatabase(adminUrl);
        const originalQuery = pools.query;
        try {
          await migrate(db.pool, { ...quiet, directory });
          await db.pool.query(
            "INSERT INTO users(username,email,password_hash) VALUES ('Guilherme','one@example.com','test')",
          );
          if (collision)
            await db.pool.query(
              "INSERT INTO users(username,email,password_hash) VALUES ('gUILHERME','two@example.com','test')",
            );
          const before = await databaseSnapshot(db.pool);
          const history = (
            await db.pool.query(
              "SELECT * FROM schema_migrations ORDER BY version",
            )
          ).rows;
          if (collision) {
            await assert.rejects(
              migrate(db.pool, quiet),
              /case_insensitive_username_collisions=1/,
            );
            assert.deepEqual(await databaseSnapshot(db.pool), before);
            assert.deepEqual(
              (
                await db.pool.query(
                  "SELECT * FROM schema_migrations ORDER BY version",
                )
              ).rows,
              history,
            );
            pools.query = db.pool.query.bind(db.pool);
            await assert.rejects(
              findUserByUsername("GUILHERME"),
              /Ambiguous username/,
            );
          } else {
            await migrate(db.pool, quiet);
            const after = await databaseSnapshot(db.pool);
            for (const section of ["tables", "sequences", "views"])
              assert.deepEqual(after[section], before[section]);
            assert.deepEqual(
              (
                await db.pool.query(
                  "SELECT * FROM schema_migrations WHERE version<=6 ORDER BY version",
                )
              ).rows,
              history,
            );
            assert.equal(
              (
                await db.pool.query(
                  "SELECT count(*)::int AS count FROM schema_migrations",
                )
              ).rows[0].count,
              7,
            );
            assert.ok(
              after.schema.constraints.some(
                (row) => row.name === "users_username_key",
              ),
            );
            assert.ok(
              after.schema.indexes.some(
                (row) => row.name === "users_username_lower_unique",
              ),
            );
          }
        } finally {
          pools.query = originalQuery;
          await db.dispose();
        }
      }
    } finally {
      await rm(temp, { recursive: true });
    }
  },
);

test(
  "PostgreSQL and controllers enforce case-insensitive registration/update races",
  { timeout: 30000 },
  async () => {
    const db = await createTestDatabase(adminUrl);
    const originalQuery = pools.query;
    try {
      await migrate(db.pool, quiet);
      raceUsernamePrechecks(db.pool);
      const responses = [response(), response()];
      await Promise.all(
        responses.map((res, i) =>
          register(
            {
              body: {
                username: i ? "gUILHERME" : "Guilherme",
                email: `race${i}@example.com`,
                password: "password123",
              },
            },
            res,
          ),
        ),
      );
      assert.deepEqual(
        responses.map((res) => res.statusCode).sort(),
        [201, 409],
      );
      assert.equal(
        responses.find((res) => res.statusCode === 409).body.error,
        "Username already in use",
      );
      assert.equal(
        (
          await db.pool.query(
            "SELECT count(*)::int AS count FROM users WHERE LOWER(username)='guilherme'",
          )
        ).rows[0].count,
        1,
      );
      pools.query = db.pool.query.bind(db.pool);
      const user = responses.find((res) => res.statusCode === 201).body.user;
      const duplicate = response();
      await register(
        {
          body: {
            username: "GUILHERME",
            email: "unique@example.com",
            password: "password123",
          },
        },
        duplicate,
      );
      assert.equal(duplicate.statusCode, 409);
      await assert.rejects(
        db.pool.query(
          "INSERT INTO users(username,email,password_hash) VALUES ('GUILHERME','db@example.com','test')",
        ),
        (err) =>
          err.code === "23505" &&
          err.constraint === "users_username_lower_unique",
      );

      const changed = response();
      await updateUsernameHandler(
        {
          userId: user.id,
          body: { newUsername: "GuIlHeRmE", password: "password123" },
        },
        changed,
      );
      assert.equal(changed.statusCode, 200);
      assert.equal(changed.body.id, user.id);
      assert.equal(changed.body.username, "GuIlHeRmE");
      const other = await createAccount("Another", "another@example.com");
      const conflict = response();
      await updateUsernameHandler(
        {
          userId: other.id,
          body: { newUsername: "guilherme", password: "password123" },
        },
        conflict,
      );
      assert.equal(conflict.statusCode, 409);
      assert.equal(conflict.body.error, "Username already in use");

      raceUsernamePrechecks(db.pool);
      const updates = [response(), response()];
      await Promise.all(
        updates.map((res, i) =>
          updateUsernameHandler(
            {
              userId: [user.id, other.id][i],
              body: {
                newUsername: i ? "Renamed" : "RENAMED",
                password: "password123",
              },
            },
            res,
          ),
        ),
      );
      assert.deepEqual(updates.map((res) => res.statusCode).sort(), [200, 409]);
      assert.equal(
        updates.find((res) => res.statusCode === 409).body.error,
        "Username already in use",
      );
    } finally {
      pools.query = originalQuery;
      await db.dispose();
    }
  },
);

test(
  "profiles, follow, Top Five, review history, search and watchlists retain identity across username casing and renames",
  { timeout: 30000 },
  async () => {
    const db = await createTestDatabase(adminUrl);
    const originalQuery = pools.query;
    try {
      await migrate(db.pool, quiet);
      pools.query = db.pool.query.bind(db.pool);
      const user = await createAccount("Guilherme", "profile@example.com");
      const viewer = await createAccount("Viewer", "viewer@example.com");
      const media = (
        await db.pool.query(
          "INSERT INTO media(external_id,source,type,title) VALUES ('42','tmdb','movie','Movie') RETURNING id",
        )
      ).rows[0];
      await db.pool.query(
        "INSERT INTO top_five(user_id,media_id,rank) VALUES ($1,$2,1)",
        [user.id, media.id],
      );
      await db.pool.query(
        "INSERT INTO reviews(user_id,media_id,score) VALUES ($1,$2,8.5)",
        [user.id, media.id],
      );
      await db.pool.query(
        "INSERT INTO watchlist(user_id,media_id) VALUES ($1,$2)",
        [user.id, media.id],
      );

      for (const canonical of ["Guilherme", "gUILHERME", "NewName"]) {
        const update = response();
        await updateUsernameHandler(
          {
            userId: user.id,
            body: { newUsername: canonical, password: "password123" },
          },
          update,
        );
        assert.equal(update.statusCode, 200);
        for (const username of [
          canonical,
          canonical.toLowerCase(),
          canonical.toUpperCase(),
        ]) {
          assert.equal((await findUserByUsername(username)).id, user.id);
          const follow = response();
          await postFollow({ userId: viewer.id, params: { username } }, follow);
          assert.equal(follow.statusCode, 201);
          const profile = response();
          await getPublicProfile(
            { userId: viewer.id, params: { username } },
            profile,
          );
          assert.equal(profile.body.id, user.id);
          assert.equal(profile.body.username, canonical);
          assert.equal(profile.body.viewerFollows, true);
          const anonymous = response();
          await getPublicProfile({ params: { username } }, anonymous);
          assert.equal(anonymous.statusCode, 200);
          assert.equal(anonymous.body.viewerFollows, false);
          const self = response();
          await postFollow({ userId: user.id, params: { username } }, self);
          assert.equal(self.statusCode, 400);
          const top = response();
          await getTopFiveForUsername({ params: { username } }, top);
          assert.equal(top.body[0].media_id, media.id);
          const reviews = response();
          await getUserReviews({ params: { username }, query: {} }, reviews);
          assert.equal(reviews.body.username, canonical);
          assert.equal(reviews.body.total, 1);
          const search = response();
          await searchUsers({ query: { q: username } }, search);
          assert.equal(
            search.body.find((row) => row.id === user.id).username,
            canonical,
          );
          const unfollow = response();
          await deleteFollow(
            { userId: viewer.id, params: { username } },
            unfollow,
          );
          assert.equal(unfollow.body.following, false);
        }
        const watchlist = response();
        await getMyWatchlist({ userId: user.id, query: {} }, watchlist);
        assert.equal(watchlist.body[0].media_id, media.id);
      }
      assert.equal(
        await findUserByUsername("guilherme"),
        undefined,
        "Renames do not create aliases for old names",
      );
    } finally {
      pools.query = originalQuery;
      await db.dispose();
    }
  },
);
