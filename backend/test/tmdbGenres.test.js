import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";

const calls = [];
let failRawg = false;
axios.defaults.adapter = async (config) => {
  calls.push(config);
  if (failRawg && config.url === "/games") throw new Error("RAWG unavailable");
  return {
    data: {
      results: [{ id: 10, title: "Movie", name: "Series", release_date: "2024-01-01", first_air_date: "2024-01-01", vote_average: 7, rating: 4 }],
    },
    status: 200,
    headers: {},
    config,
  };
};
const { TMDB_MOVIES_GENRES, TMDB_TV_GENRES } = await import("../src/services/tmbdService.js");
const { getDiscover } = await import("../src/controllers/mediaController.js");

test("movie and series genres produce the correct TMDB with_genres parameters", async () => {
  const expected = {
    movie: { action: 28, drama: 18, comedy: 35, scifi: 878, horror: 27 },
    series: { action: 10759, drama: 18, comedy: 35, scifi: 10765 },
  };
  assert.deepEqual(TMDB_MOVIES_GENRES, expected.movie);
  assert.deepEqual(TMDB_TV_GENRES, expected.series);
  for (const [type, genres] of Object.entries(expected)) {
    for (const [genre, id] of Object.entries(genres)) {
      calls.length = 0;
      const res = { status(code) { assert.fail(`Unexpected HTTP ${code}`); }, json(body) { return body; } };
      await getDiscover({ query: { types: type, genre } }, res);
      assert.ok(calls.length > 0);
      assert.ok(calls.every((call) => call.url === (type === "movie" ? "/discover/movie" : "/discover/tv")));
      assert.ok(calls.every((call) => call.params.with_genres === id), `${type}/${genre}`);
    }
  }
  for (const genre of ["action", "drama", "comedy", "scifi"]) {
    calls.length = 0;
    await getDiscover({ query: { types: "movie,series", genre } }, { json() {} });
    assert.ok(calls.some((call) => call.url === "/discover/movie" && call.params.with_genres === expected.movie[genre]));
    assert.ok(calls.some((call) => call.url === "/discover/tv" && call.params.with_genres === expected.series[genre]));
  }
});

test("unsupported providers are excluded while supported providers receive the genre", async () => {
  for (const types of ["series", "game,series"]) {
    calls.length = 0;
    let status;
    const res = { status(code) { status = code; return this; }, json() {} };
    await getDiscover({ query: { types, genre: "horror" } }, res);
    assert.equal(status, 400);
    assert.equal(calls.length, 0);
  }

  for (const types of ["movie,series", "movie,series,game", "game,movie"]) {
    calls.length = 0;
    let body;
    await getDiscover({ query: { types, genre: "horror" } }, { json(value) { body = value; } });
    assert.equal(calls.some((call) => call.url === "/discover/movie"), true);
    assert.equal(calls.some((call) => call.url === "/discover/tv"), false);
    assert.equal(calls.some((call) => call.url === "/games"), false);
    assert.match(body.warnings[0], /not available/);
  }
});

test("All types routes each genre only to providers that support it", async () => {
  for (const [genre, expectedUrls, excludedUrls] of [
    ["drama", ["/discover/movie", "/discover/tv"], ["/games"]],
    ["rpg", ["/games"], ["/discover/movie", "/discover/tv"]],
  ]) {
    calls.length = 0;
    let body;
    await getDiscover({ query: { types: "movie,series,game", genre } }, { json(value) { body = value; } });
    for (const url of expectedUrls) assert.ok(calls.some((call) => call.url === url), `${genre} should call ${url}`);
    for (const url of excludedUrls) assert.equal(calls.some((call) => call.url === url), false, `${genre} should skip ${url}`);
    assert.ok(body.results.length > 0);
  }
});

test("discover keeps successful provider results when another provider fails", async () => {
  calls.length = 0;
  failRawg = true;
  let body;
  let status = 200;
  await getDiscover({ query: { types: "movie,game" } }, {
    status(code) { status = code; return this; },
    json(value) { body = value; },
  });
  assert.equal(status, 200);
  assert.ok(body.results.length > 0);
  assert.ok(body.results.every((item) => item.type === "movie"));
  assert.ok(body.warnings.some((warning) => warning.includes("RAWG game")));
  failRawg = false;
});
