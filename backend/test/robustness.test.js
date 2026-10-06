import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pools } from "../src/config/db.js";
import { register, login, updateEmail, updateUsernameHandler, deleteAccount } from "../src/controllers/authController.js";
import { postReview, putReview } from "../src/controllers/reviewController.js";
import { putTopFive } from "../src/controllers/topFiveController.js";
import { postFollow } from "../src/controllers/followController.js";
import { postWatchlist, getMyWatchlist } from "../src/controllers/watchlistController.js";
import { authMiddleware } from "../src/middleware/auth.js";
import { optionalAuth } from "../src/middleware/optionalAuth.js";
import { validateEnvironment } from "../src/config/env.js";

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }, send() { return this; } };
}
const originalQuery = pools.query;
const originalCompare = bcrypt.compare;
const originalHash = bcrypt.hash;
test.afterEach(() => {
  pools.query = originalQuery;
  bcrypt.compare = originalCompare;
  bcrypt.hash = originalHash;
});
test.after(() => pools.end());

test("registration rejects invalid fields before querying the database", async () => {
  pools.query = () => assert.fail("Invalid registration reached the database");
  const valid = { username: "valid.user_1", email: "valid@example.com", password: "password123" };
  for (const change of [{ username: "ab" }, { username: "a".repeat(51) }, { username: "bad-name" },
    { username: 123 }, { email: "invalid" }, { email: {} }, { password: "short" }, { password: {} },
    { password: "a".repeat(73) }]) {
    const res = response();
    await register({ body: { ...valid, ...change } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(typeof res.body.error, "string");
  }
});

test("registration, login and email updates normalize emails; Settings wrong passwords remain ordinary 401s", async () => {
  process.env.JWT_SECRET = "test-only-secret";
  const calls = [];
  pools.query = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("INSERT")) return { rows: [{ id: 1, username: values[0], email: values[1] }] };
    return { rows: [] };
  };
  bcrypt.hash = async () => "test-hash";
  let res = response();
  await register({ body: { username: "valid_user", email: "  MIXED@Example.COM ", password: "password123" } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(calls[0].values[0], "mixed@example.com");
  assert.match(calls[0].sql, /LOWER\(TRIM\(email\)\)/);
  assert.equal(res.body.user.email, "mixed@example.com");
  const user = { id: 1, username: "valid_user", email: "mixed@example.com", password_hash: "hash" };
  pools.query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [user] };
  };
  bcrypt.compare = async () => true;
  res = response();
  await login({ body: { email: " MIXED@EXAMPLE.COM ", password: "old" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.at(-1).values[0], "mixed@example.com");
  res = response();
  await updateEmail({ userId: 1, body: { newEmail: " NEW@Example.COM ", password: "old" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.at(-1).values[0], "new@example.com");
  bcrypt.compare = async () => false;
  for (const handler of [updateEmail, updateUsernameHandler, deleteAccount]) {
    res = response();
    await handler({ userId: 1, body: { newEmail: "new@example.com", newUsername: "new_user", password: "wrong" } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, undefined);
  }
});

test("review create/update reject missing, non-numeric, non-finite and out-of-range scores and unsafe comments", async () => {
  pools.query = () => assert.fail("Invalid review reached the database");
  for (const handler of [postReview, putReview]) {
    for (const score of [undefined, null, "8", NaN, Infinity, -1, 11]) {
      const res = response();
      await handler({ userId: 1, params: { id: 1 }, body: { mediaId: 1, score } }, res);
      assert.equal(res.statusCode, 400);
    }
    const res = response();
    await handler({ body: { mediaId: 1, score: 0, comment: {} } }, res);
    assert.equal(res.statusCode, 400);
  }
  const calls = [];
  pools.query = async (sql, values) => { calls.push({ sql, values }); return { rows: [{ user_id: 1 }] }; };
  const res = response();
  await putReview({ userId: 1, params: { id: 1 }, body: { score: 0, comment: null } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.at(-1).values, [0, null, 1]);
});

test("top five rejects invalid IDs, duplicates, ranks and entry counts before a transaction", async () => {
  const invalid = [[null], [{ mediaId: -1, rank: 1 }], [{ mediaId: "1", rank: 1 }],
    [{ mediaId: 1.5, rank: 1 }], [{ mediaId: 1, rank: 1 }, { mediaId: 1, rank: 2 }],
    [{ mediaId: 1, rank: 1 }, { mediaId: 2, rank: 1 }], [{ mediaId: 1, rank: 1.5 }],
    [{ mediaId: 1, rank: "1" }], [{ mediaId: 1 }], [{ mediaId: 1, rank: 6 }], Array(6).fill({ mediaId: 1, rank: 1 })];
  const connect = pools.connect;
  pools.connect = () => assert.fail("Invalid top five reached a transaction");
  try {
    for (const items of invalid) {
      const res = response();
      await putTopFive({ body: { items }, userId: 1 }, res);
      assert.equal(res.statusCode, 400);
    }
  } finally { pools.connect = connect; }
});

test("top five keeps the transaction and rolls back unknown media IDs", async () => {
  const connect = pools.connect;
  const statements = [];
  let failInsert = false;
  pools.connect = async () => ({
    async query(sql) {
      statements.push(sql);
      if (failInsert && sql.startsWith("INSERT")) throw Object.assign(new Error("Foreign key"), { code: "23503" });
    },
    release() { statements.push("RELEASE"); },
  });
  pools.query = async () => ({ rows: [] });
  try {
    let res = response();
    await putTopFive({ userId: 1, body: { items: [{ mediaId: 1, rank: 1 }] } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(statements[0], "BEGIN");
    assert.deepEqual(statements.slice(-2), ["COMMIT", "RELEASE"]);
    failInsert = true;
    res = response();
    await putTopFive({ userId: 1, body: { items: [{ mediaId: 999, rank: 1 }] } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(statements.slice(-2), ["ROLLBACK", "RELEASE"]);
  } finally { pools.connect = connect; }
});

test("follow rejects self-targets and watchlist rejects invalid statuses", async () => {
  pools.query = async () => ({ rows: [{ id: 1, username: "alice" }] });
  let res = response();
  await postFollow({ userId: 1, params: { username: "alice" } }, res);
  assert.equal(res.statusCode, 400);

  pools.query = () => assert.fail("Invalid watchlist status reached the database");
  res = response();
  await postWatchlist({ userId: 1, body: { mediaId: 1, status: "queued" } }, res);
  assert.equal(res.statusCode, 400);
  res = response();
  await getMyWatchlist({ userId: 1, query: { status: "queued" } }, res);
  assert.equal(res.statusCode, 400);
});

test("JWT failures have a machine-readable code; optional profiles remain public", () => {
  process.env.JWT_SECRET = "test-only-secret";
  for (const token of ["invalid", jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: -1 }),
    jwt.sign({}, process.env.JWT_SECRET)]) {
    const res = response();
    authMiddleware({ headers: { authorization: "Bearer " + token } }, res, () => assert.fail("Invalid token accepted"));
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, "INVALID_TOKEN");
  }
  for (const authorization of [undefined, "Bearer invalid"]) {
    let called = false;
    optionalAuth({ headers: { authorization } }, response(), () => { called = true; });
    assert.equal(called, true);
  }
});

test("all supported game genres reach RAWG distinctly, for discovery and text search", async () => {
  const calls = [];
  axios.defaults.adapter = async (config) => {
    calls.push(config);
    return { data: { results: [{ id: 1, name: "Game", rating: 4, released: "2024-01-01", genres: [{ slug: config.params.genres }] }], next: null }, status: 200, headers: {}, config };
  };
  const { RAWG_GENRE_SLUGS, discoverGames, searchRawg } = await import("../src/services/rawgService.js");
  const { getGenreOptions } = await import("../../frontend/src/constants/mediaGenres.js");
  assert.equal(getGenreOptions(["game"]).length, Object.keys(RAWG_GENRE_SLUGS).length);
  for (const { value } of getGenreOptions(["game"])) {
    await discoverGames({ genre: value, page: 1, pageSize: 20, minRating: 8 });
    assert.equal(calls.at(-1).params.genres, RAWG_GENRE_SLUGS[value]);
    assert.equal(calls.at(-1).timeout, 5000);
    await searchRawg("game", value);
    assert.equal(calls.at(-1).params.genres, RAWG_GENRE_SLUGS[value]);
  }
  assert.equal(new Set(calls.map((call) => call.params.genres)).size, 12);
  assert.ok(getGenreOptions(["movie", "series", "game"]).some((g) => g.value === "drama"));
  assert.ok(getGenreOptions(["movie", "series", "game"]).some((g) => g.value === "rpg"));
  assert.equal(getGenreOptions(["series"]).some((g) => g.value === "horror"), false);
  const { getDiscover } = await import("../src/controllers/mediaController.js");
  let res = response();
  await getDiscover({ query: { types: "game", genre: "rpg", query: "game" } }, res);
  assert.equal(res.body.results.length, 1);
  res = response();
  const count = calls.length;
  await getDiscover({ query: { types: "game,movie", genre: "rpg" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, count + 1);
  assert.equal(calls.at(-1).url, "/games");
});

test("environment validation names missing variables and validates defaults", () => {
  assert.throws(() => validateEnvironment({}), /DATABASE_URL, JWT_SECRET, TMDB_API_KEY, RAWG_API_KEY/);
  const env = { DATABASE_URL: "postgresql://localhost/test", JWT_SECRET: "test", TMDB_API_KEY: "test", RAWG_API_KEY: "test" };
  assert.deepEqual(validateEnvironment(env), { port: 3000, frontendOrigin: "http://localhost:5173" });
  assert.throws(() => validateEnvironment({ ...env, PORT: "invalid" }), /PORT/);
  assert.throws(() => validateEnvironment({ ...env, FRONTEND_URL: "https://example.com/path" }), /FRONTEND_URL/);
});

test("startup fails before HTTP listening when configuration or database checks fail", () => {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const env = { ...process.env, DOTENV_CONFIG_PATH: "test/nonexistent.env", DATABASE_URL: "", JWT_SECRET: "", TMDB_API_KEY: "", RAWG_API_KEY: "" };
  let child = spawnSync(process.execPath, ["server.js"], { cwd, env, encoding: "utf8" });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /Missing required environment variables/);
  const preload = `import { registerHooks } from 'node:module'; registerHooks({load(url, context, next) {
    if (url.endsWith('/src/config/db.js')) return {format:'module',shortCircuit:true,source:"export const pools={query:async()=>{throw Error('SECRET connection string')},end:async()=>{}}"};
    return next(url, context);
  }});`;
  child = spawnSync(process.execPath, ["--import", "data:text/javascript," + encodeURIComponent(preload), "server.js"], {
    cwd, encoding: "utf8", env: { ...env, DATABASE_URL: "postgresql://localhost/test", JWT_SECRET: "test", TMDB_API_KEY: "test", RAWG_API_KEY: "test" },
  });
  assert.equal(child.status, 1);
  assert.match(child.stderr, /Database connection failed/);
  assert.doesNotMatch(child.stdout + child.stderr, /SECRET|Server running/);

  const successPreload = `import { registerHooks } from 'node:module'; registerHooks({load(url, context, next) {
    if (url.endsWith('/src/config/db.js')) return {format:'module',shortCircuit:true,source:"export const pools={query:async()=>console.log('DATABASE_CHECK'),end:async()=>{}}"};
    if (url.endsWith('/src/app.js')) return {format:'module',shortCircuit:true,source:"export default {listen(port,done){console.log('HTTP_LISTEN');queueMicrotask(done);return {once(){}}}}"};
    return next(url, context);
  }});`;
  child = spawnSync(process.execPath, ["--import", "data:text/javascript," + encodeURIComponent(successPreload), "server.js"], {
    cwd, encoding: "utf8", env: { ...env, DATABASE_URL: "postgresql://localhost/test", JWT_SECRET: "test", TMDB_API_KEY: "test", RAWG_API_KEY: "test" },
  });
  assert.equal(child.status, 0);
  assert.ok(child.stdout.indexOf("DATABASE_CHECK") < child.stdout.indexOf("HTTP_LISTEN"));
  assert.match(child.stdout, /Server running/);
});

test("CORS advertises only the configured origin without enabling cookies", async () => {
  process.env.FRONTEND_URL = "https://frontend.example.com";
  const { default: app } = await import("../src/app.js");
  const cors = app.router.stack.find((layer) => layer.name === "corsMiddleware").handle;
  for (const origin of ["https://frontend.example.com", "https://untrusted.example.com"]) {
    const headers = {};
    let ended = false;
    cors({ method: "OPTIONS", headers: { origin, "access-control-request-method": "PUT" } }, {
      setHeader(key, value) { headers[key.toLowerCase()] = value; },
      getHeader(key) { return headers[key.toLowerCase()]; },
      end() { ended = true; },
    }, () => assert.fail("Preflight should end in the CORS middleware"));
    assert.equal(ended, true);
    assert.equal(headers["access-control-allow-origin"], "https://frontend.example.com");
    assert.equal(headers["access-control-allow-credentials"], undefined);
  }
  delete process.env.FRONTEND_URL;
});
