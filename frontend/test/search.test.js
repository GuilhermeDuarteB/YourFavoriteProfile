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
const read = (file) =>
  parse(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"))
    .descriptor;
const searchFile = read("views/SearchView.vue");
const navbarFile = read("components/NavBar.vue");
const stripImports = (source) =>
  source.replace(/^\s*import[\s\S]*?;\r?\n/gm, "");
const RouterLink = {
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
              : props.to.name === "profile"
                ? `/${props.to.params.username}`
                : "/",
        },
        slots.default?.(),
      ),
};
const MediaCard = {
  components: { RouterLink },
  props: ["id", "type", "title", "posterUrl", "score", "meta", "developer"],
  render: compile(read("components/MediaCard.vue").template.content),
};
const render = (descriptor, state) =>
  renderToString(
    createSSRApp({
      components: {
        RouterLink,
        MediaCard,
        NavBar: { render: () => h("nav") },
        Footer: { render: () => h("footer") },
      },
      setup: () => state,
      render: compile(descriptor.template.content),
    }),
  );

function searchPage(api, q = "dune") {
  const route = reactive({ query: { q } });
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "computed",
      "ref",
      "watch",
      "useRoute",
      "api",
      stripImports(searchFile.scriptSetup.content) +
        "\nreturn { query, media, users, loading, mediaLoading, usersLoading, mediaError, usersError, mediaWarnings, activeTab, tabs, loadMedia, loadUsers };",
    )(computed, ref, watch, () => route, api),
  );
  return {
    route,
    state,
    stop: () => scope.stop(),
    render: () => render(searchFile, state),
  };
}
const mediaRows = [
  { id: 1, type: "movie", title: "Dune movie", score: 8, posterUrl: null },
  { id: 2, type: "series", title: "Dune series", score: 7, posterUrl: null },
  { id: 3, type: "game", title: "Dune game", score: 9, posterUrl: null },
];
const userRows = [
  { id: 4, username: "dune_fan", avatar_url: null },
  {
    id: 5,
    username: "dune_avatar",
    avatar_url: "https://example.com/avatar.png",
  },
];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test("Navbar uses native form submission for Enter and the accessible search button; trims and ignores whitespace", async () => {
  const pushes = [],
    route = reactive({ query: { q: "  dune  " } });
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "ref",
      "watch",
      "useRoute",
      "useRouter",
      "useAuthStore",
      stripImports(navbarFile.scriptSetup.content) +
        "\nreturn { authStore, searchQuery, search };",
    )(
      ref,
      watch,
      () => route,
      () => ({ push: (value) => pushes.push(value) }),
      () => ({ isAuthenticated: false }),
    ),
  );
  try {
    const html = await render(navbarFile, state);
    assert.match(html, /<form[^>]*role="search"/);
    assert.match(html, /<button[^>]*type="submit"[^>]*aria-label="Search"/);
    assert.match(html, /placeholder="Search media or users\.\.\."/);
    assert.match(navbarFile.template.content, /@submit\.prevent="search"/);
    state.search();
    assert.deepEqual(pushes, [{ name: "search", query: { q: "dune" } }]);
    state.searchQuery.value = " \t ";
    state.search();
    assert.equal(pushes.length, 1);
    route.query.q = "new query";
    await settle();
    assert.equal(state.searchQuery.value, "new query");
  } finally {
    scope.stop();
  }
});

test("global search requests both APIs and renders movie, series, game, users, avatars and profile links", async () => {
  const calls = [];
  const page = searchPage(
    {
      get: async (url, options) => {
        calls.push({ url, options });
        return {
          data: url.includes("discover")
            ? { results: mediaRows, warnings: ["RAWG temporarily unavailable"] }
            : userRows,
        };
      },
    },
    "  dune  ",
  );
  try {
    await settle();
    assert.deepEqual(
      calls.map(({ url }) => url),
      ["/media/discover", "/users/search"],
    );
    assert.deepEqual(calls[0].options.params, { query: "dune" });
    assert.deepEqual(calls[1].options.params, { q: "dune" });
    const html = await page.render();
    for (const item of mediaRows) {
      assert.ok(html.includes(item.title));
      assert.ok(html.includes(`href="/${item.type}/${item.id}"`));
    }
    assert.match(html, /href="\/dune_fan"/);
    assert.match(html, /dune_avatar/);
    assert.match(html, /https:\/\/example.com\/avatar.png/);
    assert.match(html, /class="avatar">D/);
    assert.match(html, /RAWG temporarily unavailable/);
    assert.equal(page.state.loading.value, false);
  } finally {
    page.stop();
  }
});

test("successful user results are shown while media is still loading, and vice versa", async () => {
  for (const slowGroup of ["media", "users"]) {
    const slow = deferred();
    const page = searchPage({
      get: (url) => {
        const group = url.includes("discover") ? "media" : "users";
        if (group === slowGroup) return slow.promise;
        return Promise.resolve({
          data: group === "media" ? { results: mediaRows } : userRows,
        });
      },
    });
    try {
      await settle();
      const html = await page.render();
      assert.match(html, slowGroup === "media" ? /dune_fan/ : /Dune movie/);
      assert.match(
        html,
        slowGroup === "media" ? /Loading media/ : /Loading users/,
      );
      slow.resolve({
        data: slowGroup === "media" ? { results: mediaRows } : userRows,
      });
      await settle();
      assert.equal(page.state.loading.value, false);
    } finally {
      page.stop();
    }
  }
});

test("media/user failures leave the other results visible and retry only the failed group", async () => {
  for (const failedGroup of ["media", "users"]) {
    let failing = true;
    const calls = [];
    const page = searchPage({
      get: async (url) => {
        calls.push(url);
        const group = url.includes("discover") ? "media" : "users";
        if (group === failedGroup && failing) throw Error("Unavailable");
        return { data: group === "media" ? { results: mediaRows } : userRows };
      },
    });
    try {
      await settle();
      const html = await page.render();
      assert.match(html, /role="alert"/);
      assert.match(html, failedGroup === "media" ? /dune_fan/ : /Dune movie/);
      failing = false;
      await (failedGroup === "media"
        ? page.state.loadMedia()
        : page.state.loadUsers());
      assert.equal(calls.length, 3);
      assert.equal(page.state.mediaError.value, "");
      assert.equal(page.state.usersError.value, "");
    } finally {
      page.stop();
    }
  }
});

test("changing queries refreshes both searches and stale responses cannot replace newer results or errors", async () => {
  const calls = [];
  const page = searchPage(
    {
      get: (url, options) => {
        const pending = deferred();
        calls.push({ url, options, ...pending });
        return pending.promise;
      },
    },
    "old",
  );
  try {
    page.route.query.q = " newer ";
    assert.equal(calls.length, 4);
    assert.ok(calls.slice(0, 2).every(({ options }) => options.signal.aborted));
    calls[2].resolve({
      data: {
        results: [{ id: 6, type: "game", title: "New game" }],
        warnings: ["New warning"],
      },
    });
    calls[3].resolve({ data: [{ id: 7, username: "new_user" }] });
    await settle();
    calls[0].resolve({
      data: { results: mediaRows, warnings: ["Old warning"] },
    });
    calls[1].reject(Error("Old request failed"));
    await settle();
    assert.equal(page.state.media.value[0].title, "New game");
    assert.equal(page.state.users.value[0].username, "new_user");
    assert.deepEqual(page.state.mediaWarnings.value, ["New warning"]);
    assert.equal(page.state.usersError.value, "");
    assert.equal(page.state.loading.value, false);
    page.route.query.q = "   ";
    assert.equal(calls.length, 4);
    assert.equal(page.state.media.value.length, 0);
    assert.equal(page.state.users.value.length, 0);
    assert.match(
      await page.render(),
      /Search for movies, series, games, or users/,
    );
  } finally {
    page.stop();
  }
});

test("All, Media, Users select the correct result sections without additional requests", async () => {
  let requests = 0;
  const page = searchPage({
    get: async (url) => {
      requests++;
      return {
        data: url.includes("discover") ? { results: mediaRows } : userRows,
      };
    },
  });
  try {
    await settle();
    assert.equal(page.state.activeTab.value, "all");
    for (const tab of ["all", "media", "users"]) {
      page.state.activeTab.value = tab;
      const html = await page.render();
      assert.equal(html.includes('id="media-results-title"'), tab !== "users");
      assert.equal(html.includes('id="user-results-title"'), tab !== "media");
      assert.match(html, /aria-pressed="true"/);
    }
    assert.equal(requests, 2);
    page.route.query.q = "other";
    assert.equal(page.state.activeTab.value, "all");
    await settle();
  } finally {
    page.stop();
  }
});

test("empty searches and empty API results have distinct helpful states", async () => {
  let requests = 0;
  const page = searchPage(
    {
      get: async (url) => {
        requests++;
        return { data: url.includes("discover") ? { results: [] } : [] };
      },
    },
    "",
  );
  try {
    assert.equal(requests, 0);
    page.route.query.q = "nothing";
    await settle();
    const html = await page.render();
    assert.match(html, /No media found/);
    assert.match(html, /No users found/);
  } finally {
    page.stop();
  }
});
