import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ref, computed, watch, reactive, effectScope, nextTick } from "vue";
import { getGenreOptions } from "../src/constants/mediaGenres.js";

const gameGenres = [
  "action",
  "adventure",
  "rpg",
  "strategy",
  "shooter",
  "puzzle",
  "racing",
  "sports",
  "simulation",
  "indie",
  "casual",
  "arcade",
];
const combinations = [
  [["movie"], ["action", "drama", "comedy", "scifi", "horror"]],
  [["series"], ["action", "drama", "comedy", "scifi"]],
  [
    ["movie", "series"],
    ["action", "drama", "comedy", "scifi", "horror"],
  ],
  [["game"], gameGenres],
  [
    ["game", "movie"],
    ["action", "drama", "comedy", "scifi", "horror", ...gameGenres.slice(1)],
  ],
  [
    ["game", "series"],
    ["action", "drama", "comedy", "scifi", ...gameGenres.slice(1)],
  ],
  [
    ["movie", "series", "game"],
    ["action", "drama", "comedy", "scifi", "horror", ...gameGenres.slice(1)],
  ],
];
const settle = () => new Promise((resolve) => setImmediate(resolve));
const debounce = () => new Promise((resolve) => setTimeout(resolve, 240));

function mountBrowse(query = {}) {
  const route = reactive({ query });
  const calls = [];
  const api = {
    get: async (url, { params }) => {
      calls.push(params);
      return { data: { results: [], hasMore: false } };
    },
  };
  const source = fs
    .readFileSync(
      new URL("../src/views/BrowseView.vue", import.meta.url),
      "utf8",
    )
    .match(/<script setup>([\s\S]*?)<\/script>/)[1]
    .replace(/^\s*import[\s\S]*?;\r?\n/gm, "");
  let mounted, unmount;
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "ref",
      "computed",
      "watch",
      "onMounted",
      "onBeforeUnmount",
      "useRoute",
      "useRouter",
      "useAuthStore",
      "api",
      "getGenreOptions",
      source +
        "\nreturn {selectedTypes,selectedGenre,genreOptions,toggleType,allTypesSelected};",
    )(
      ref,
      computed,
      watch,
      (cb) => {
        mounted = cb;
      },
      (cb) => {
        unmount = cb;
      },
      () => route,
      () => ({
        replace: ({ query }) => {
          route.query = query;
        },
      }),
      () => ({ isAuthenticated: false }),
      api,
      getGenreOptions,
    ),
  );
  mounted();
  return {
    state,
    calls,
    route,
    stop() {
      unmount();
      scope.stop();
    },
  };
}

test("all seven combinations expose the centralized genre lists and restore valid genre URLs", async () => {
  for (const [types, expected] of combinations) {
    assert.deepEqual(
      getGenreOptions(types).map((g) => g.value),
      expected,
    );
    assert.deepEqual(
      getGenreOptions([...types].reverse()).map((g) => g.value),
      expected,
    );
    for (const genre of expected) {
      const browse = mountBrowse({ types: types.join(","), genre });
      try {
        await settle();
        assert.deepEqual(
          browse.state.genreOptions.value.map((g) => g.value),
          expected,
        );
        assert.equal(browse.state.selectedGenre.value, genre);
        assert.equal(browse.calls.at(-1).genre, genre);
        assert.equal(browse.calls.at(-1).types, types.join(","));
      } finally {
        browse.stop();
      }
    }
  }
});

test("clicking Movies or Series from All selects that type instead of leaving Games selected", async () => {
  for (const type of ["movie", "series", "game"]) {
    const browse = mountBrowse();
    try {
      browse.state.toggleType(type);
      assert.deepEqual([...browse.state.selectedTypes.value], [type]);
      assert.equal(browse.state.allTypesSelected.value, false);
      assert.deepEqual(
        browse.state.genreOptions.value.map((g) => g.value),
        combinations.find(
          ([types]) => types.length === 1 && types[0] === type,
        )[1],
      );
      await nextTick();
      await debounce();
      assert.equal(browse.route.query.types, type);
      assert.equal(browse.calls.at(-1).types, type);
    } finally {
      browse.stop();
    }
  }
});

test("pills build mixed selections and reset only when a genre is unsupported", async () => {
  const browse = mountBrowse({ types: "movie", genre: "horror" });
  try {
    browse.state.toggleType("series");
    assert.deepEqual(
      [...browse.state.selectedTypes.value],
      ["movie", "series"],
    );
    assert.equal(browse.state.selectedGenre.value, "horror");
    browse.state.selectedGenre.value = "drama";
    browse.state.toggleType("game");
    assert.equal(browse.state.selectedGenre.value, "drama");
    assert.ok(browse.state.genreOptions.value.some((g) => g.value === "rpg"));
    await nextTick();
    await debounce();
    assert.equal(browse.route.query.genre, "drama");
    assert.equal(browse.route.query.types, "movie,series,game");
  } finally {
    browse.stop();
  }
  const invalid = mountBrowse({ types: "series", genre: "horror" });
  try {
    await settle();
    assert.equal(invalid.state.selectedGenre.value, "all");
    assert.equal(invalid.route.query.genre, undefined);
    assert.equal(invalid.calls.at(-1).genre, "all");
  } finally {
    invalid.stop();
  }
});
