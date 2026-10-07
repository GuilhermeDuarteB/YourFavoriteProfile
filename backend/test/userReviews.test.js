import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { pools } from "../src/config/db.js";
import { getUserReviews } from "../src/controllers/userController.js";
import {
  getUserReviewPage,
  getReviewsByUser,
} from "../src/models/reviewModel.js";

const originalQuery = pools.query;
const originalError = console.error;
test.afterEach(() => {
  pools.query = originalQuery;
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
});
const reviews = [
  {
    id: 1,
    score: 9,
    comment: "Movie comment",
    createdAt: "2024-01-01",
    mediaId: 11,
    externalId: "101",
    mediaType: "movie",
    mediaTitle: "Movie",
    posterUrl: null,
    genres: ["Action"],
    episodeId: null,
    episodeTitle: null,
    episodeNumber: null,
    seasonNumber: null,
  },
  {
    id: 2,
    score: 8,
    comment: "Game comment",
    createdAt: "2024-02-01",
    mediaId: 12,
    externalId: "102",
    mediaType: "game",
    mediaTitle: "Game",
    posterUrl: null,
    genres: ["Adventure"],
    episodeId: null,
    episodeTitle: null,
    episodeNumber: null,
    seasonNumber: null,
  },
  {
    id: 3,
    score: 10,
    comment: "Episode comment",
    createdAt: "2024-03-01",
    mediaId: 13,
    externalId: "103",
    mediaType: "series",
    mediaTitle: "Series",
    posterUrl: null,
    genres: ["Drama"],
    episodeId: 31,
    episodeTitle: "Pilot",
    episodeNumber: 1,
    seasonNumber: 1,
  },
  {
    id: 4,
    score: 6,
    comment: "Legacy",
    createdAt: "2023-01-01",
    mediaId: 13,
    externalId: "103",
    mediaType: "series",
    mediaTitle: "Series",
    posterUrl: null,
    genres: ["Drama"],
    episodeId: null,
    episodeTitle: null,
    episodeNumber: null,
    seasonNumber: null,
  },
];
function databaseStub() {
  const calls = [];
  pools.query = async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes("FROM users"))
      return {
        rows: values[0] === "alice" ? [{ id: 1, username: "alice" }] : [],
      };
    assert.match(sql, /LEFT JOIN episodes ep ON ep.id = r.episode_id/);
    assert.match(sql, /LEFT JOIN seasons se ON se.id = ep.season_id/);
    assert.match(sql, /m.id = COALESCE\(r.media_id, se.media_id\)/);
    assert.match(sql, /\$3 = ANY\(genres\)/);
    assert.match(sql, /score >= \$4/);
    assert.match(sql, /LIMIT \$5 OFFSET \$6/);
    const [, type, genre, minScore, limit, offset] = values;
    const filtered = reviews.filter(
      (review) =>
        (!type || review.mediaType === type) &&
        (!genre || review.genres.includes(genre)) &&
        (minScore == null || review.score >= minScore),
    );
    const comparator = sql.includes("ORDER BY score DESC")
      ? (a, b) => b.score - a.score
      : sql.includes("ORDER BY score ASC")
        ? (a, b) => a.score - b.score
        : sql.includes('ORDER BY "createdAt" ASC')
          ? (a, b) => a.createdAt.localeCompare(b.createdAt)
          : (a, b) => b.createdAt.localeCompare(a.createdAt);
    return {
      rows: [
        {
          total: String(filtered.length),
          totalUserReviews: "4",
          reviews: filtered.sort(comparator).slice(offset, offset + limit),
          availableGenres: ["Action", "Adventure", "Drama"],
        },
      ],
    };
  };
  return calls;
}

test("public user review history includes movie/game and parent-resolved episode reviews, without changing the preview", async () => {
  const calls = databaseStub(),
    res = response();
  await getUserReviews({ params: { username: "alice" }, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.username, "alice");
  assert.equal(res.body.total, 4);
  assert.equal(res.body.pageSize, 20);
  assert.equal(res.body.totalPages, 1);
  assert.deepEqual(
    res.body.reviews.map((review) => review.mediaType),
    ["series", "game", "movie", "series"],
  );
  const episode = res.body.reviews.find((review) => review.episodeId);
  assert.equal(episode.mediaId, 13);
  assert.equal(episode.mediaTitle, "Series");
  assert.equal(episode.episodeTitle, "Pilot");
  assert.deepEqual(episode.genres, ["Drama"]);
  assert.match(calls[1].sql, /r.episode_id AS "episodeId"/);
  assert.match(calls[1].sql, /r.score::float8 AS score/);
  pools.query = async (sql, values) => {
    assert.match(sql, /LIMIT \$2/);
    assert.deepEqual(values, [1, 6]);
    return { rows: [] };
  };
  await getReviewsByUser(1);
});

test("type, parent genre and minimum score filters use bound values and retain unfiltered genre options", async () => {
  for (const type of ["movie", "series", "game"]) {
    const calls = databaseStub(),
      res = response();
    await getUserReviews(
      { params: { username: "alice" }, query: { type } },
      res,
    );
    assert.ok(res.body.reviews.every((review) => review.mediaType === type));
    assert.equal(calls[1].values[1], type);
  }
  const calls = databaseStub(),
    res = response();
  await getUserReviews(
    {
      params: { username: "alice" },
      query: { genre: " Drama ", minScore: "8" },
    },
    res,
  );
  assert.deepEqual(
    res.body.reviews.map((review) => review.id),
    [3],
  );
  assert.deepEqual(calls[1].values, [1, null, "Drama", 8, 20, 0]);
  assert.deepEqual(res.body.availableGenres, ["Action", "Adventure", "Drama"]);
  const fiveStars = await getUserReviewPage(1, { minScore: 10 });
  assert.deepEqual(
    fiveStars.reviews.map((review) => review.id),
    [3],
  );
  const empty = await getUserReviewPage(1, { genre: "Does not exist" });
  assert.equal(empty.total, 0);
  assert.equal(empty.totalPages, 0);
  assert.equal(empty.totalUserReviews, 4);
});

test("all sorting choices and server pagination are deterministic and bounded", async () => {
  for (const [sort, expected] of [
    ["newest", [3, 2, 1, 4]],
    ["oldest", [4, 1, 2, 3]],
    ["highest", [3, 1, 2, 4]],
    ["lowest", [4, 2, 1, 3]],
  ]) {
    const calls = databaseStub();
    const data = await getUserReviewPage(1, { sort });
    assert.deepEqual(
      data.reviews.map((review) => review.id),
      expected,
    );
    assert.match(calls[0].sql, /id (DESC|ASC) LIMIT/);
  }
  const calls = databaseStub(),
    res = response();
  await getUserReviews(
    { params: { username: "alice" }, query: { page: "2", pageSize: "2" } },
    res,
  );
  assert.deepEqual(
    res.body.reviews.map((review) => review.id),
    [1, 4],
  );
  assert.equal(res.body.totalPages, 2);
  assert.equal(res.body.page, 2);
  assert.deepEqual(calls[1].values.slice(4), [2, 2]);
  const outside = await getUserReviewPage(1, { page: 10, pageSize: 2 });
  assert.deepEqual(outside.reviews, []);
  assert.equal(outside.total, 4);
});

test("unknown usernames, invalid filters and database failures are handled safely", async () => {
  databaseStub();
  let res = response();
  await getUserReviews({ params: { username: "missing" }, query: {} }, res);
  assert.equal(res.statusCode, 404);
  pools.query = () => assert.fail("Invalid filter reached database");
  for (const query of [
    { type: "all" },
    { type: ["movie", "game"] },
    { minScore: "bad" },
    { minScore: "11" },
    { minScore: "-1" },
    { minScore: " " },
    { genre: [] },
    { genre: " " },
    { genre: "x".repeat(101) },
    { sort: "score;DROP" },
    { page: "0" },
    { page: "1.5" },
    { page: "9007199254740992" },
    { pageSize: "101" },
    { pageSize: "-1" },
  ]) {
    res = response();
    await getUserReviews({ params: { username: "alice" }, query }, res);
    assert.equal(res.statusCode, 400);
  }
  pools.query = async () => {
    throw Error("Database secret");
  };
  console.error = () => {};
  res = response();
  await getUserReviews({ params: { username: "alice" }, query: {} }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "Error loading user reviews");
});

test("the new route is public, mounted before the profile route, and returns normalized review metadata", async () => {
  databaseStub();
  const { default: router } = await import("../src/routes/userRoutes.js");
  const paths = router.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  assert.ok(paths.indexOf("/:username/reviews") < paths.indexOf("/:username"));
  const { default: app } = await import("../src/app.js");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const res = await fetch(
      `http://127.0.0.1:${server.address().port}/api/users/alice/reviews?type=series&minScore=8`,
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).reviews[0].episodeId, 31);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
