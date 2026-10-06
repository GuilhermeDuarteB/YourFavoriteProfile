import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import axios from "axios";
import { ref, computed, watch, reactive, effectScope, nextTick } from "vue";
import { createPinia, defineStore } from "pinia";
import { getGenreOptions } from "../src/constants/mediaGenres.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const stripImports = (source) => source.replace(/^\s*import[\s\S]*?;\r?\n/gm, "");
const settle = () => new Promise((resolve) => setImmediate(resolve));
const debounce = () => new Promise((resolve) => setTimeout(resolve, 240));

test("Axios uses configured/fallback URL and only logs out the rejected current JWT", async () => {
  let logouts = 0;
  const store = { token: "current", logout() { logouts++; } };
  function createApi(url) {
    const source = stripImports(read("../src/api/axios.js"))
      .replace("import.meta.env.VITE_API_URL", "apiUrl").replace("export default api;", "return api;");
    return new Function("axios", "useAuthStore", "apiUrl", source)(axios, () => store, url);
  }
  assert.equal(createApi(undefined).defaults.baseURL, "http://localhost:3000/api");
  const api = createApi("https://api.example.com/api");
  assert.equal(api.defaults.baseURL, "https://api.example.com/api");
  const reject = api.interceptors.response.handlers[0].rejected;
  const error = (code, token = "current") => ({ response: { status: 401, data: { code } }, config: { headers: { Authorization: "Bearer " + token } } });
  for (const failure of [error(undefined), error("AUTH_REQUIRED"), error("INVALID_TOKEN", "old")]) {
    await assert.rejects(reject(failure));
    assert.equal(logouts, 0);
  }
  await assert.rejects(reject(error("INVALID_TOKEN")));
  assert.equal(logouts, 1);
});

test("malformed stored users cannot crash Pinia initialization or leave a token-only session", () => {
  for (const saved of ["{invalid", "null", "[]", "42", '{"id":1}']) {
    const entries = new Map([["user", saved], ["token", "old-token"]]);
    const storage = { getItem: (key) => entries.get(key) ?? null, removeItem: (key) => entries.delete(key) };
    const source = stripImports(read("../src/stores/authStore.js")).replace("export const", "const") + "\nreturn useAuthStore;";
    const useStore = new Function("defineStore", "api", "localStorage", source)(defineStore, {}, storage);
    const store = useStore(createPinia());
    assert.equal(store.user, null);
    assert.equal(store.token, null);
    assert.equal(entries.has("user"), false);
  }
});

test("Browse restores game genres and watchlist URLs, resets incompatible genres, and retains identity matching", async () => {
  const route = reactive({ query: { types: "game", genre: "rpg", watchlist: "true" } });
  const auth = reactive({ isAuthenticated: true, token: "token", user: { username: "alice" } });
  const calls = [];
  const api = { get: async (url, { params } = {}) => {
    calls.push({ url, params });
    if (url === "/watchlist/me") return { data: [{ media_id: 900, external_id: "42", type: "game" }] };
    return { data: { results: [{ id: 42, type: "game", title: "Game", score: 8 }, { id: 42, type: "movie", title: "Different identity" }], hasMore: false } };
  } };
  let mounted;
  let unmount;
  const source = stripImports(read("../src/views/BrowseView.vue").match(/<script setup>([\s\S]*?)<\/script>/)[1]);
  const scope = effectScope();
  const state = scope.run(() => new Function("ref", "computed", "watch", "onMounted", "onBeforeUnmount", "useRoute", "useRouter", "useAuthStore", "api", "getGenreOptions",
    source + "\nreturn {selectedTypes,selectedGenre,genreOptions,results,watchlistOnly};")(
    ref, computed, watch, (cb) => { mounted = cb; }, (cb) => { unmount = cb; }, () => route,
    () => ({ replace: ({ query }) => { route.query = query; } }), () => auth, api, getGenreOptions,
  ));
  try {
    mounted(); await settle();
    assert.equal(state.selectedGenre.value, "rpg");
    assert.equal(calls.at(-1).params.genre, "rpg");
    assert.deepEqual(state.results.value.map((item) => item.type), ["game"]);
    state.selectedGenre.value = "strategy";
    await nextTick(); await debounce(); await settle();
    assert.equal(calls.at(-1).params.genre, "strategy");
    assert.equal(route.query.genre, "strategy");
    assert.equal(calls.filter((call) => call.url === "/watchlist/me").length, 1);
    state.selectedTypes.value = ["movie"];
    assert.equal(state.selectedGenre.value, "all");
    await nextTick(); await debounce(); await settle();
    assert.equal(calls.at(-1).params.genre, "all");
    assert.equal(route.query.genre, undefined);
    assert.equal(route.query.watchlist, "true");
    route.query = { types: "game", genre: "racing", watchlist: "true" };
    await nextTick(); await debounce(); await settle();
    assert.equal(state.selectedGenre.value, "racing");
    assert.equal(calls.at(-1).params.genre, "racing");
    state.selectedTypes.value = ["movie", "series", "game"];
    assert.ok(state.genreOptions.value.some((option) => option.value === "drama"));
    assert.ok(state.genreOptions.value.some((option) => option.value === "rpg"));
    assert.equal(state.selectedGenre.value, "racing");
  } finally { unmount(); scope.stop(); }
});

test("navbar search trims queries and ignores empty submissions", () => {
  const route = reactive({ query: {} });
  const pushed = [];
  const source = stripImports(read("../src/components/NavBar.vue").match(/<script setup>([\s\S]*?)<\/script>/)[1]);
  const state = new Function("ref", "watch", "useRoute", "useRouter", "useAuthStore", source + "\nreturn { searchQuery, search };")(
    ref, watch, () => route, () => ({ push: (value) => pushed.push(value) }), () => ({ isAuthenticated: false }),
  );
  state.searchQuery.value = "  dune  ";
  state.search();
  assert.deepEqual(pushed, [{ name: "search", query: { q: "dune" } }]);
  state.searchQuery.value = "   ";
  state.search();
  assert.equal(pushed.length, 1);
});

test("FollowButton emits its changed state only after a successful request", async () => {
  const calls = [];
  let changed;
  const source = stripImports(read("../src/components/FollowButton.vue").match(/<script setup>([\s\S]*?)<\/script>/)[1]);
  const state = new Function("ref", "watch", "defineProps", "defineEmits", "api", source + "\nreturn { following, toggle };")(
    ref, watch, () => ({ username: "alice", initialFollowing: false }), () => (event, value) => { if (event === "changed") changed = value; },
    { post: async (url) => { calls.push(url); }, delete: async () => { throw new Error("failed"); } },
  );
  await state.toggle();
  assert.equal(state.following.value, true);
  assert.equal(changed, true);
  const originalError = console.error;
  console.error = () => {};
  await state.toggle();
  console.error = originalError;
  assert.equal(state.following.value, true);
  assert.deepEqual(calls, ["/follow/alice"]);
});

test("SearchView reads the route query and loads media and user results", async () => {
  const route = reactive({ query: { q: "  dune " } });
  const calls = [];
  const source = stripImports(read("../src/views/SearchView.vue").match(/<script setup>([\s\S]*?)<\/script>/)[1]);
  const scope = effectScope();
  const state = scope.run(() => new Function("computed", "ref", "watch", "useRoute", "api", source + "\nreturn { query, media, users, loading };")(
    computed, ref, watch, () => route,
    { get: async (url, options) => { calls.push({ url, options }); return { data: url.includes("discover") ? { results: [{ id: 1 }], warnings: [] } : [{ id: 2 }] }; } },
  ));
  await settle();
  assert.equal(state.query.value, "dune");
  assert.deepEqual(calls.map((call) => call.url).sort(), ["/media/discover", "/users/search"]);
  assert.equal(state.media.value.length, 1);
  assert.equal(state.users.value.length, 1);
  scope.stop();
});
