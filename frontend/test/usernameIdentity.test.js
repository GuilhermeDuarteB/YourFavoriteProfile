import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "@vue/compiler-sfc";
import {
  compile,
  computed,
  createSSRApp,
  effectScope,
  h,
  reactive,
  ref,
  watch,
} from "vue";
import { renderToString } from "@vue/server-renderer";

const settle = () => new Promise((resolve) => setImmediate(resolve));
const profile = (id = 7, username = "Guilherme") => ({
  id,
  username,
  createdAt: "2024-01-01",
  bio: "",
  avatarUrl: null,
  stats: { reviewCount: 0, avgScore: null },
  recentReviews: [],
  genreBreakdown: [],
  followCounts: { followers: 0, following: 0 },
  viewerFollows: false,
  topFive: [],
});
function mount(view, api, username = "GUILHERME") {
  const route = reactive({ params: { username } });
  const authStore = reactive({
    user: { id: 7, username: "Guilherme" },
    isAuthenticated: true,
  });
  const descriptor = parse(
    fs.readFileSync(
      new URL(`../src/views/${view}.vue`, import.meta.url),
      "utf8",
    ),
  ).descriptor;
  const exports =
    view === "ProfileView"
      ? "profile, loading, error, isOwnProfile, formatDate, updateFollowing, authStore"
      : "route, owner, items, loading, error, activeStatus, statuses, isOwnWatchlist, removeItem, updateStatus";
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "ref",
      "computed",
      "watch",
      "useRoute",
      "useAuthStore",
      "api",
      descriptor.scriptSetup.content.replace(/^\s*import[\s\S]*?;\r?\n/gm, "") +
        `\nreturn {${exports}};`,
    )(
      ref,
      computed,
      watch,
      () => route,
      () => authStore,
      api,
    ),
  );
  const components = Object.fromEntries(
    ["NavBar", "Footer", "GenreRadar", "MediaCard"].map((name) => [
      name,
      { render: () => h("div") },
    ]),
  );
  components.FollowButton = {
    props: ["username"],
    render() {
      return h("button", { "data-follow": this.username }, "Follow");
    },
  };
  components.RouterLink = {
    props: ["to"],
    setup:
      (props, { slots }) =>
      () =>
        h(
          "a",
          {
            href:
              typeof props.to === "string"
                ? props.to
                : props.to.path || `/${props.to.params?.username}/reviews`,
          },
          slots.default?.(),
        ),
  };
  return {
    state,
    route,
    authStore,
    stop: () => scope.stop(),
    html: () =>
      renderToString(
        createSSRApp({
          components,
          setup: () => state,
          render: compile(descriptor.template.content),
        }),
      ),
  };
}

test("alternate-case profiles use IDs for edit/follow controls and canonical review links", async () => {
  const page = mount("ProfileView", { get: async () => ({ data: profile() }) });
  try {
    await settle();
    assert.equal(page.state.isOwnProfile.value, true);
    let html = await page.html();
    assert.match(html, /<h1>Guilherme<\/h1>/);
    assert.match(html, /Edit profile/);
    assert.doesNotMatch(html, /data-follow/);
    assert.match(html, /href="\/Guilherme\/reviews"/);
    page.authStore.user.username = "StaleSessionName";
    assert.equal(page.state.isOwnProfile.value, true);
    page.authStore.user.id = 8;
    page.authStore.user.username = "Guilherme";
    assert.equal(page.state.isOwnProfile.value, false);
    html = await page.html();
    assert.match(html, /data-follow="Guilherme"/);
    assert.doesNotMatch(html, /Edit profile/);
    page.authStore.user = null;
    page.authStore.isAuthenticated = false;
    assert.doesNotMatch(await page.html(), /data-follow/);
  } finally {
    page.stop();
  }
});

test("watchlist resolves owner ID, shows canonical casing and caches identity across filters", async () => {
  const calls = [];
  const page = mount("WatchlistView", {
    get: async (url, options) => {
      calls.push({ url, options });
      return { data: url.startsWith("/users/") ? profile() : [] };
    },
  });
  try {
    await settle();
    assert.equal(page.state.isOwnWatchlist.value, true);
    assert.deepEqual(
      calls.map((call) => call.url),
      ["/users/GUILHERME", "/watchlist/me"],
    );
    assert.match(await page.html(), /Guilherme&#39;s Watchlist/);
    page.state.activeStatus.value = "completed";
    await settle();
    assert.deepEqual(calls.at(-1).options.params, { status: "completed" });
    assert.equal(
      calls.filter((call) => call.url.startsWith("/users/")).length,
      1,
    );
    page.route.params.username = "guilherme";
    await settle();
    assert.equal(page.state.isOwnWatchlist.value, true);
    assert.equal(
      calls.filter((call) => call.url.startsWith("/users/")).length,
      1,
    );
    const count = calls.length;
    page.authStore.user = null;
    page.authStore.isAuthenticated = false;
    await settle();
    assert.equal(calls.length, count);
    assert.equal(page.state.isOwnWatchlist.value, false);
    assert.match(await page.html(), /Watchlists are private/);
  } finally {
    page.stop();
  }
});

test("another user's watchlist never requests private data even if session names match", async () => {
  const calls = [];
  const page = mount("WatchlistView", {
    get: async (url) => {
      calls.push(url);
      assert.ok(url.startsWith("/users/"));
      return { data: profile(8) };
    },
  });
  try {
    await settle();
    assert.equal(page.state.isOwnWatchlist.value, false);
    assert.deepEqual(calls, ["/users/GUILHERME"]);
    assert.match(await page.html(), /Watchlists are private/);
  } finally {
    page.stop();
  }
});

test("route changes ignore stale profile/ownership responses and display lookup errors", async () => {
  for (const view of ["ProfileView", "WatchlistView"]) {
    const pending = [];
    const page = mount(view, {
      get: (url) =>
        new Promise((resolve, reject) =>
          pending.push({ url, resolve, reject }),
        ),
    });
    try {
      page.route.params.username = "Other";
      await settle();
      pending[1].resolve({ data: profile(8, "Other") });
      await settle();
      pending[0].resolve({ data: profile() });
      await settle();
      const user =
        view === "ProfileView" ? page.state.profile : page.state.owner;
      assert.equal(user.value.id, 8);
      assert.equal(page.state.loading.value, false);
      assert.equal(pending.length, 2);
      page.route.params.username = "Missing";
      await settle();
      pending[2].reject({ response: { status: 404 } });
      await settle();
      assert.match(await page.html(), /User not found/);
    } finally {
      page.stop();
    }
  }
});
