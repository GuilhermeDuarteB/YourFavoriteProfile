import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";

const calls = [];
axios.defaults.adapter = async (config) => {
  calls.push(config);
  return { data: { results: [] }, status: 200, headers: {}, config };
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

test("unsupported TV horror and incompatible mixed genres are rejected before external calls", async () => {
  for (const types of ["series", "movie,series", "game,movie", "game,series", "movie,series,game"]) {
    calls.length = 0;
    let status;
    const res = { status(code) { status = code; return this; }, json() {} };
    await getDiscover({ query: { types, genre: "horror" } }, res);
    assert.equal(status, 400);
    assert.equal(calls.length, 0);
  }
});
