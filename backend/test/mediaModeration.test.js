import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { pools } from "../src/config/db.js";
import { getTopFiveByUser } from "../src/models/topFiveModel.js";
import { getWatchlistByUser } from "../src/models/watchlistModel.js";
import {
  getReviewsByUser,
  getUserReviewPage,
} from "../src/models/reviewModel.js";
import { putTopFive } from "../src/controllers/topFiveController.js";
import { postWatchlist } from "../src/controllers/watchlistController.js";
import {
  postReview,
  getMediaReviews,
  getEpisodeReviews,
} from "../src/controllers/reviewController.js";

const blockedTitle = "A n.i.g.g.e.r story";
const originalQuery = pools.query;
const originalConnect = pools.connect;
const originalAdapter = axios.defaults.adapter;
let providerAdapter = () => assert.fail("Unexpected provider request");
axios.defaults.adapter = (config) => providerAdapter(config);
const {
  getTrending,
  getDiscover,
  getLatestEpisodes,
  getMediaDetails,
  getSeasonEpisodes,
} = await import("../src/controllers/mediaController.js");
axios.defaults.adapter = originalAdapter;

test.afterEach(() => {
  pools.query = originalQuery;
  pools.connect = originalConnect;
  providerAdapter = () => assert.fail("Unexpected provider request");
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
const item = (id, title = "Safe adventure") => ({
  id,
  title,
  name: title,
  media_type: "movie",
  vote_average: 8,
  rating: 4,
  release_date: "2024-01-01",
  first_air_date: "2024-01-01",
  released: "2024-01-01",
});
function providers(getData) {
  providerAdapter = async (config) => ({
    data: getData(config),
    status: 200,
    headers: {},
    config,
  });
}

test("trending and all-provider search hide blocked titles including original provider names", async () => {
  providers(() => ({
    results: [
      item(1, blockedTitle),
      item(2),
      { ...item(3), original_name: blockedTitle },
    ],
  }));
  const trending = response();
  await getTrending({}, trending);
  assert.equal(trending.statusCode, 200);
  assert.deepEqual(
    trending.body.map((media) => media.id),
    [2, 2],
  );
  const search = response();
  await getDiscover({ query: { query: "adventure" } }, search);
  assert.deepEqual(
    search.body.results.map((media) => media.id),
    [2, 2, 2],
  );
  assert.equal(search.body.hasMore, false);
  assert.equal(JSON.stringify(search.body).includes(blockedTitle), false);
});

test("filtered discover pages retain provider pagination even when every title is unavailable", async () => {
  providers((config) => ({
    results: Array.from({ length: config.params.page_size || 20 }, (_, i) =>
      item(i + 1, blockedTitle),
    ),
    next: "next-page",
  }));
  for (const types of ["movie", "series", "game", "movie,series,game"]) {
    const res = response();
    await getDiscover({ query: { types } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.results, []);
    assert.equal(res.body.hasMore, true);
  }
});

test("direct details reject movie, series and game titles before any database access", async () => {
  pools.query = () => assert.fail("Blocked details reached persistence");
  providers((config) =>
    config.url.endsWith("/credits")
      ? { cast: [] }
      : { ...item(1), original_title: blockedTitle },
  );
  for (const type of ["movie", "series", "game"]) {
    const res = response();
    await getMediaDetails({ params: { type, id: "1" } }, res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { error: "Media unavailable" });
  }
});

test("latest episodes filter both parent shows and episode titles", async () => {
  providers((config) =>
    config.url === "/trending/tv/week"
      ? { results: [item(1), item(2), item(3, blockedTitle)] }
      : {
          ...item(Number(config.url.split("/").at(-1))),
          last_episode_to_air: {
            name: config.url === "/tv/1" ? blockedTitle : "Pilot",
            season_number: 1,
            episode_number: 1,
          },
        },
  );
  const res = response();
  await getLatestEpisodes({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, "Pilot");
});

test("season requests reject blocked parents and never import blocked episodes", async () => {
  pools.query = () => assert.fail("Blocked series reached persistence");
  providers((config) =>
    config.url.includes("/season/")
      ? { name: "Season 1", episodes: [] }
      : config.url.endsWith("/credits")
        ? { cast: [] }
        : item(1, blockedTitle),
  );
  const blocked = response();
  await getSeasonEpisodes({ params: { id: "1", seasonNumber: "1" } }, blocked);
  assert.equal(blocked.statusCode, 404);
  const calls = [];
  pools.query = async (sql, values) => {
    calls.push({ sql, values });
    return {
      rows: sql.startsWith("SELECT") ? [] : [{ id: 1, type: "series" }],
    };
  };
  providers((config) =>
    config.url.includes("/season/")
      ? {
          name: "Season 1",
          episodes: [
            { name: blockedTitle, episode_number: 1 },
            { name: "Pilot", episode_number: 2 },
          ],
        }
      : config.url.endsWith("/credits")
        ? { cast: [] }
        : item(1),
  );
  const safe = response();
  await getSeasonEpisodes({ params: { id: "1", seasonNumber: "1" } }, safe);
  assert.equal(safe.statusCode, 200);
  assert.deepEqual(
    safe.body.episodes.map((episode) => episode.title),
    ["Pilot"],
  );
  assert.ok(calls.every(({ values }) => !values.includes(blockedTitle)));
});

test("stored Top Five, watchlists and profile reviews omit blocked media without changing stored rows", async () => {
  const rows = [
    { id: 1, title: blockedTitle },
    { id: 2, title: "Safe", comment: blockedTitle },
    { id: 3, title: "Series", episode_title: blockedTitle },
  ];
  const before = structuredClone(rows);
  pools.query = async (sql) => {
    assert.match(sql.trimStart(), /^SELECT/);
    return { rows };
  };
  assert.deepEqual(
    (await getTopFiveByUser(1)).map((row) => row.id),
    [2, 3],
  );
  assert.deepEqual(
    (await getWatchlistByUser(1)).map((row) => row.id),
    [2, 3],
  );
  const reviews = await getReviewsByUser(1);
  assert.deepEqual(
    reviews.map((row) => row.id),
    [2],
  );
  assert.equal(reviews[0].comment, null);
  assert.deepEqual(rows, before);
});

test("review history excludes hidden titles before page counts, ordering and genre options", async () => {
  const rows = [
    { id: 3, mediaTitle: blockedTitle, genres: ["Blocked genre"] },
    { id: 2, mediaTitle: "Allowed", comment: blockedTitle, genres: ["Drama"] },
    {
      id: 1,
      mediaTitle: "Series",
      episodeTitle: blockedTitle,
      genres: ["Action"],
    },
  ];
  const calls = [];
  pools.query = async (sql, values) => {
    calls.push(structuredClone(values));
    assert.match(sql, /NOT \(r.id = ANY\(\$7::int\[\]\)\)/);
    const allowed = rows.filter((row) => !values[6].includes(row.id));
    return {
      rows: [
        {
          moderationCandidates: allowed,
          reviews: allowed.slice(values[5], values[5] + values[4]),
          total: allowed.length,
          totalUserReviews: allowed.length,
          availableGenres: [...new Set(allowed.flatMap((row) => row.genres))],
        },
      ],
    };
  };
  const result = await getUserReviewPage(1, { pageSize: 1 });
  assert.equal(result.total, 1);
  assert.equal(result.totalUserReviews, 1);
  assert.equal(result.totalPages, 1);
  assert.deepEqual(result.availableGenres, ["Drama"]);
  assert.equal(result.reviews[0].id, 2);
  assert.equal(result.reviews[0].comment, null);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1][6], [3, 1]);
});

test("direct review and watchlist requests cannot select hidden stored media or episodes", async () => {
  pools.query = async (sql) => {
    assert.match(sql.trimStart(), /^SELECT/);
    return { rows: [{ id: 1, type: "movie", title: blockedTitle }] };
  };
  for (const [handler, req] of [
    [postReview, { userId: 1, body: { mediaId: 1, score: 8 } }],
    [postReview, { userId: 1, body: { episodeId: 1, score: 8 } }],
    [postWatchlist, { userId: 1, body: { mediaId: 1 } }],
    [getMediaReviews, { params: { mediaId: 1 } }],
    [getEpisodeReviews, { params: { episodeId: 1 } }],
  ]) {
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 404);
    assert.equal(JSON.stringify(res.body).includes(blockedTitle), false);
  }
});

test("Top Five replacement preserves existing hidden favorites and rejects new blocked selections transactionally", async () => {
  for (const existingHidden of [true, false]) {
    const statements = [];
    let released = false;
    pools.connect = async () => ({
      async query(sql) {
        statements.push(sql);
        if (sql.includes("FROM top_five"))
          return { rows: existingHidden ? [{ title: blockedTitle }] : [] };
        if (sql.includes("FROM media"))
          return { rows: [{ id: 1, title: blockedTitle }] };
        return { rows: [] };
      },
      release() {
        released = true;
      },
    });
    const res = response();
    await putTopFive(
      { userId: 1, body: { items: [{ mediaId: 1, rank: 1 }] } },
      res,
    );
    assert.equal(res.statusCode, existingHidden ? 409 : 400);
    assert.equal(statements.at(-1), "ROLLBACK");
    assert.ok(statements.every((sql) => !/^(DELETE|INSERT|UPDATE)/.test(sql)));
    assert.equal(released, true);
    assert.equal(JSON.stringify(res.body).includes(blockedTitle), false);
  }
});
