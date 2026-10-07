import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import axios from "axios";
import { pools } from "../src/config/db.js";
import {
  postReview,
  putReview,
  removeReview,
} from "../src/controllers/reviewController.js";
import {
  findOrCreateSeason,
  findOrCreateEpisode,
} from "../src/models/mediaModel.js";
import {
  getMediaRating,
  getSeriesMedia,
  getReviewsByUser,
  getGenreBreakdown,
} from "../src/models/reviewModel.js";
import { getUserStats } from "../src/models/userModel.js";

const originalQuery = pools.query;
const originalAdapter = axios.defaults.adapter;
let providerAdapter = () => assert.fail("Unexpected provider request");
axios.defaults.adapter = (config) => providerAdapter(config);
// Provider clients capture their adapter at creation; intercept before importing them.
const { getSeasonEpisodes, getMediaDetails } =
  await import("../src/controllers/mediaController.js");
const { default: mediaRoutes } = await import("../src/routes/mediaRoutes.js");
axios.defaults.adapter = originalAdapter;
const originalError = console.error;
test.afterEach(() => {
  pools.query = originalQuery;
  providerAdapter = () => assert.fail("Unexpected provider request");
  console.error = originalError;
});
test.after(() => pools.end());
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
  send() {},
});

function stubProvider(fail = false) {
  const calls = [];
  providerAdapter = async (config) => {
    calls.push(config);
    if (fail) throw Error("Provider unavailable");
    let data;
    if (config.url.endsWith("/season/1"))
      data = {
        name: "Season 1",
        episodes: [
          {
            episode_number: 1,
            name: "Pilot",
            air_date: "2024-01-01",
            overview: "Episode overview",
            still_path: "/pilot.jpg",
          },
          { episode_number: 2, name: "Next", air_date: null },
        ],
      };
    else if (config.url.endsWith("/credits")) data = { cast: [] };
    else
      data = {
        id: 99,
        title: "Movie",
        name: "Series or game",
        first_air_date: "2024-01-01",
        vote_average: 8,
        rating: 4,
        genres: [{ name: "Drama" }],
        seasons: [],
      };
    return { data, status: 200, headers: {}, config };
  };
  return calls;
}

test("season endpoint resolves local media, season and episode IDs and reuses persisted identities", async () => {
  const providerCalls = stubProvider();
  const calls = [];
  const rows = { media: null, season: null, episodes: new Map() };
  pools.query = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.startsWith("SELECT * FROM media"))
      return { rows: rows.media ? [rows.media] : [] };
    if (sql.startsWith("INSERT INTO media")) {
      rows.media = { id: 1001, type: "series", genres: ["Drama"] };
      return { rows: [rows.media] };
    }
    if (sql.startsWith("SELECT * FROM seasons"))
      return { rows: rows.season ? [rows.season] : [] };
    if (sql.startsWith("INSERT INTO seasons")) {
      rows.season = { id: 2001 };
      return { rows: [rows.season] };
    }
    if (sql.startsWith("SELECT * FROM episodes"))
      return {
        rows: rows.episodes.has(values[1])
          ? [rows.episodes.get(values[1])]
          : [],
      };
    if (sql.startsWith("INSERT INTO episodes")) {
      const row = { id: 3000 + values[1] };
      rows.episodes.set(values[1], row);
      return { rows: [row] };
    }
    throw Error(`Unexpected query ${sql}`);
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = response();
    await getSeasonEpisodes({ params: { id: "99", seasonNumber: "1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      seasonNumber: 1,
      name: "Season 1",
      episodes: [
        {
          episodeId: 3001,
          episodeNumber: 1,
          title: "Pilot",
          overview: "Episode overview",
          airDate: "2024-01-01",
          stillUrl: "https://image.tmdb.org/t/p/w300/pilot.jpg",
        },
        {
          episodeId: 3002,
          episodeNumber: 2,
          title: "Next",
          overview: "",
          airDate: null,
          stillUrl: null,
        },
      ],
    });
  }
  assert.equal(
    calls.filter(({ sql }) => sql.startsWith("INSERT INTO episodes")).length,
    2,
  );
  assert.deepEqual(
    calls.find(({ sql }) => sql.startsWith("INSERT INTO seasons")).values,
    [1001, 1, "Season 1"],
  );
  assert.deepEqual(
    calls.find(({ sql }) => sql.startsWith("INSERT INTO episodes")).values,
    [2001, 1, "Pilot", "2024-01-01"],
  );
  assert.deepEqual(
    calls
      .find(({ sql }) => sql.startsWith("INSERT INTO media"))
      .values.slice(0, 4),
    ["99", "tmdb", "series", "Series or game"],
  );
  assert.ok(
    providerCalls.some(
      (config) => config.url === "/tv/99/season/1" && config.timeout === 5000,
    ),
  );
});

test("season identity inserts handle concurrent requests with existing UNIQUE constraints", async () => {
  const calls = [];
  pools.query = async (sql, values) => {
    calls.push({ sql, values });
    return { rows: sql.startsWith("SELECT") ? [] : [{ id: 10 }] };
  };
  assert.equal((await findOrCreateSeason(1, 2, "Season 2")).id, 10);
  assert.equal((await findOrCreateEpisode(10, 1, "Pilot", null)).id, 10);
  for (const { sql } of calls.filter(({ sql }) => sql.startsWith("INSERT"))) {
    assert.match(sql, /ON CONFLICT/);
    assert.match(sql, /RETURNING \*/);
  }
});

test("season loading never attaches episodes to a conflicting movie identity", async () => {
  stubProvider();
  console.error = () => {};
  pools.query = async (sql) => {
    assert.ok(
      sql.startsWith("INSERT INTO media"),
      "A season was persisted under a movie",
    );
    return { rows: [{ id: 1001, type: "movie", genres: ["Drama"] }] };
  };
  const res = response();
  await getSeasonEpisodes({ params: { id: "99", seasonNumber: "1" } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "Error loading season episodes");
});

test("invalid season requests fail before provider or DB access; provider failures remain safe", async () => {
  providerAdapter = () => assert.fail("Invalid request reached provider");
  pools.query = () => assert.fail("Invalid request reached DB");
  for (const seasonNumber of [
    undefined,
    "0",
    "-1",
    "1.5",
    "abc",
    "Infinity",
    "9007199254740992",
  ]) {
    const res = response();
    await getSeasonEpisodes({ params: { id: "99", seasonNumber } }, res);
    assert.equal(res.statusCode, 400);
  }
  for (const id of [undefined, "", "bad", "0", "../tv"]) {
    const res = response();
    await getSeasonEpisodes({ params: { id, seasonNumber: "1" } }, res);
    assert.equal(res.statusCode, 400);
  }
  stubProvider(true);
  console.error = () => {};
  const res = response();
  await getSeasonEpisodes({ params: { id: "99", seasonNumber: "1" } }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "Error loading season episodes");
});

test("season route precedes generic details and is mounted in the app", async () => {
  const paths = mediaRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  assert.ok(
    paths.indexOf("/series/:id/season/:seasonNumber") <
      paths.indexOf("/:type/:id"),
  );
  const { default: app } = await import("../src/app.js");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${origin}/api/media/series/99/season/0`);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /season number/);
    stubProvider();
    pools.query = async (sql, values) => ({
      rows: [
        sql.includes("media")
          ? { id: 1001, type: "series", genres: ["Drama"] }
          : sql.includes("seasons")
            ? { id: 2001 }
            : { id: 3000 + values[1] },
      ],
    });
    const valid = await fetch(`${origin}/api/media/series/99/season/1`);
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).episodes[0].episodeId, 3001);
    const docs = await fetch(`${origin}/api-docs/`);
    assert.equal(docs.status, 200);
    assert.match(await docs.text(), /swagger-ui/);
    const spec = await fetch(`${origin}/api-docs/swagger-ui-init.js`);
    assert.equal(spec.status, 200);
    assert.ok(
      (await spec.text()).includes(
        "/api/media/series/{id}/season/{seasonNumber}",
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("movie/game direct reviews and episode reviews work, with watchlist completion only for media", async () => {
  for (const target of ["movie", "game", "episode"]) {
    const calls = [];
    pools.query = async (sql, values) => {
      calls.push({ sql, values });
      if (sql === "SELECT * FROM media WHERE id = $1")
        return { rows: [{ id: 42, type: target }] };
      if (sql === "SELECT id FROM episodes WHERE id = $1")
        return { rows: [{ id: 81 }] };
      if (sql.includes("IS NOT DISTINCT")) return { rows: [] };
      if (sql.includes("SELECT * FROM watchlist"))
        return { rows: [{ status: "watching" }] };
      return { rows: [{ id: 10, score: "8.0" }] };
    };
    const res = response();
    await postReview(
      {
        userId: 1,
        body: {
          ...(target === "episode" ? { episodeId: 81 } : { mediaId: 42 }),
          score: 8,
        },
      },
      res,
    );
    assert.equal(res.statusCode, 201);
    const insert = calls.find(({ sql }) =>
      sql.startsWith("INSERT INTO reviews"),
    );
    assert.deepEqual(
      insert.values.slice(0, 3),
      target === "episode" ? [1, null, 81] : [1, 42, null],
    );
    const watchlistWrites = calls.filter(({ sql }) =>
      sql.includes("INSERT INTO watchlist"),
    );
    assert.equal(watchlistWrites.length, target === "episode" ? 0 : 1);
    if (watchlistWrites.length)
      assert.equal(watchlistWrites[0].values[2], "completed");
  }
});

test("series direct reviews are rejected; missing/both/unknown targets and duplicates retain validation", async () => {
  pools.query = async () => ({ rows: [{ id: 42, type: "series" }] });
  let res = response();
  await postReview({ userId: 1, body: { mediaId: 42, score: 8 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "Series must be reviewed by episode");
  pools.query = () => assert.fail("Bad target reached database");
  for (const body of [
    { score: 8 },
    { mediaId: 42, episodeId: 81, score: 8 },
    { mediaId: 0, episodeId: 81, score: 8 },
    ...[-1, 0, true, {}, [], "1e2", "0x2a", "bad"].map((mediaId) => ({
      mediaId,
      score: 8,
    })),
  ]) {
    res = response();
    await postReview({ userId: 1, body }, res);
    assert.equal(res.statusCode, 400);
  }
  pools.query = async () => ({ rows: [] });
  for (const body of [
    { mediaId: 42, score: 8 },
    { episodeId: 81, score: 8 },
  ]) {
    res = response();
    await postReview({ userId: 1, body }, res);
    assert.equal(res.statusCode, 404);
  }
  pools.query = async (sql) => ({ rows: [{ id: 10, type: "movie" }] });
  res = response();
  await postReview({ userId: 1, body: { mediaId: 42, score: 8 } }, res);
  assert.equal(res.statusCode, 409);
});

test("episode review updates/deletes preserve ownership checks", async () => {
  const calls = [];
  pools.query = async (sql) => {
    calls.push(sql);
    return { rows: [{ id: 10, user_id: 1, episode_id: 81, score: 7 }] };
  };
  for (const handler of [putReview, removeReview]) {
    let res = response();
    await handler({ userId: 2, params: { id: 10 }, body: { score: 7 } }, res);
    assert.equal(res.statusCode, 403);
    res = response();
    await handler({ userId: 1, params: { id: 10 }, body: { score: 7 } }, res);
    assert.equal(res.statusCode, handler === removeReview ? 204 : 200);
  }
  assert.ok(calls.some((sql) => sql.startsWith("UPDATE reviews")));
  assert.ok(calls.some((sql) => sql.startsWith("DELETE FROM reviews")));
});

test("details separate provider score and numeric community scores using the appropriate views", async () => {
  stubProvider();
  for (const type of ["movie", "game", "series"]) {
    for (const communityScore of [null, "0.0", "7.25"]) {
      const calls = [];
      pools.query = async (sql, values) => {
        calls.push({ sql, values });
        if (sql.startsWith("INSERT INTO media"))
          return { rows: [{ id: 1001, type, genres: ["Drama"] }] };
        if (sql.includes("vw_"))
          return {
            rows:
              communityScore === null
                ? []
                : [{ avg_score: communityScore, series_score: communityScore }],
          };
        throw Error("Unexpected query");
      };
      const res = response();
      await getMediaDetails({ params: { type, id: "99" } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.score, 8);
      assert.equal(
        res.body.communityScore,
        communityScore === null ? null : Number(communityScore),
      );
      assert.match(
        calls.at(-1).sql,
        type === "series" ? /vw_series_rating/ : /vw_media_rating/,
      );
      assert.deepEqual(calls.at(-1).values, [1001]);
    }
  }
  pools.query = async () => ({ rows: [{ avg_score: "0", series_score: "0" }] });
  assert.equal(await getMediaRating(1), 0);
  assert.equal(await getSeriesMedia(1), 0);
});

test("profile queries resolve episode parents without multiplicative joins, and stats count all reviews", async () => {
  const calls = [];
  pools.query = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("review_count"))
      return { rows: [{ review_count: "3", avg_score: "8" }] };
    if (sql.includes("unnest"))
      return { rows: [{ genre: "Drama", count: "2" }] };
    return {
      rows: [
        {
          id: 1,
          title: "Series",
          type: "series",
          episode_id: 81,
          episode_title: "Pilot",
          season_number: 1,
          episode_number: 1,
        },
      ],
    };
  };
  const recent = await getReviewsByUser(1);
  assert.equal(recent[0].episode_title, "Pilot");
  assert.deepEqual(await getGenreBreakdown(1), [{ genre: "Drama", count: 2 }]);
  assert.equal((await getUserStats(1)).reviewCount, 3);
  for (const { sql } of calls.slice(0, 2)) {
    assert.match(sql, /LEFT JOIN episodes ep ON ep.id = r.episode_id/);
    assert.match(sql, /LEFT JOIN seasons se ON se.id = ep.season_id/);
    assert.match(sql, /m.id = COALESCE\(r.media_id, se.media_id\)/);
  }
  assert.match(calls[0].sql, /ep.title AS episode_title/);
  assert.doesNotMatch(calls.at(-1).sql, /JOIN/);
});
