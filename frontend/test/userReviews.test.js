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
import { createRouter, createMemoryHistory } from "vue-router";

const read = (file) =>
  fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
const stripImports = (source) =>
  source.replace(/^\s*import[\s\S]*?;\r?\n/gm, "");
const descriptor = parse(read("views/UserReviewsView.vue")).descriptor;
const settle = () => new Promise((resolve) => setImmediate(resolve));
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
              : `/${props.to.params.username}`,
        },
        slots.default?.(),
      ),
};
const render = (state) =>
  renderToString(
    createSSRApp({
      setup: () => state,
      render: compile(descriptor.template.content),
      components: {
        RouterLink,
        NavBar: { render: () => h("nav") },
        Footer: { render: () => h("footer") },
      },
    }),
  );
const fixture = {
  username: "alice",
  page: 1,
  pageSize: 20,
  total: 21,
  totalPages: 2,
  totalUserReviews: 21,
  availableGenres: ["Drama", "Adventure"],
  reviews: [
    {
      id: 1,
      mediaTitle: "Series",
      mediaType: "series",
      externalId: "99",
      score: 8,
      comment: "An episode",
      episodeId: 81,
      seasonNumber: 1,
      episodeNumber: 3,
      episodeTitle: "Pilot",
      createdAt: "2024-01-01",
    },
    {
      id: 2,
      mediaTitle: "Movie",
      mediaType: "movie",
      externalId: "42",
      score: 9,
      comment: null,
      episodeId: null,
      createdAt: "2024-01-01",
    },
    {
      id: 3,
      mediaTitle: "Old Series Review",
      mediaType: "series",
      externalId: "98",
      score: 7,
      episodeId: null,
      createdAt: "2024-01-01",
    },
  ],
};
function pageHarness(api, query = {}) {
  const route = reactive({ params: { username: "alice" }, query });
  const pushes = [],
    replaces = [];
  const router = {
    push: (value) => {
      pushes.push(value);
      route.query = value.query;
    },
    replace: (value) => {
      replaces.push(value);
      route.query = value.query;
    },
  };
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "computed",
      "ref",
      "watch",
      "useRoute",
      "useRouter",
      "api",
      stripImports(descriptor.scriptSetup.content) +
        "\nreturn { route, result, availableGenres, loading, error, types, ratings, sorts, filters, hasFilters, updateFilter, changePage, loadReviews, mediaLink, formatDate };",
    )(
      computed,
      ref,
      watch,
      () => route,
      () => router,
      api,
    ),
  );
  return {
    state,
    route,
    pushes,
    replaces,
    stop: () => scope.stop(),
    render: () => render(state),
  };
}

test("the public user reviews route resolves before the generic profile route without requiring auth", () => {
  const source = read("router/index.js");
  const components = Object.fromEntries(
    [...source.matchAll(/^import (\w+) from /gm)].map((match) => [
      match[1],
      { render: () => h("div") },
    ]),
  );
  const bindings = {
    createRouter,
    createWebHistory: createMemoryHistory,
    useAuthStore: () => ({ isAuthenticated: false }),
    ...components,
  };
  const router = new Function(
    ...Object.keys(bindings),
    stripImports(source).replace("export default router;", "return router;"),
  )(...Object.values(bindings));
  assert.equal(router.resolve("/alice/reviews").name, "user-reviews");
  assert.equal(router.resolve("/alice").name, "profile");
  assert.equal(router.resolve("/search?q=dune").name, "search");
  assert.equal(router.resolve("/alice/reviews").meta.requiresAuth, undefined);
});

test("review page renders controls, episode context, legacy reviews, score, date and media links", async () => {
  const page = pageHarness({ get: async () => ({ data: fixture }) });
  try {
    await settle();
    const html = await page.render();
    for (const label of [
      "Rating",
      "Genre",
      "Sort",
      "Movies",
      "Series",
      "Games",
      "S01E03 · Pilot",
      "Legacy series review",
      "No comment left.",
      "★ 8.0",
    ])
      assert.ok(html.includes(label), label);
    assert.match(html, /href="\/series\/99"/);
    assert.match(html, /href="\/alice"/);
    assert.match(html, /for="review-rating"/);
    assert.match(html, /id="review-rating"/);
    for (const name of ["rating", "genre", "sort"])
      assert.match(
        html,
        new RegExp(`for="review-${name}"[^>]*>[^<]+</label>\\s*<select`),
      );
    assert.match(html, /Page 1 of 2/);
  } finally {
    page.stop();
  }
});

test("URL restores filters; type, star rating, genre and sort changes reset pagination and send the correct API parameters", async () => {
  const calls = [];
  const page = pageHarness(
    {
      get: async (url, options) => {
        calls.push({ url, options });
        return {
          data: { ...fixture, page: options.params.page, totalPages: 5 },
        };
      },
    },
    {
      type: "series",
      minScore: "8",
      genre: "Drama",
      sort: "oldest",
      page: "2",
    },
  );
  try {
    await settle();
    assert.equal(calls[0].url, "/users/alice/reviews");
    assert.deepEqual(calls[0].options.params, {
      type: "series",
      minScore: "8",
      genre: "Drama",
      sort: "oldest",
      page: 2,
      pageSize: 20,
    });
    for (const [key, value] of [
      ["type", "movie"],
      ["minScore", "10"],
      ["genre", "Adventure"],
      ["sort", "highest"],
    ]) {
      page.state.updateFilter(key, value);
      await settle();
      assert.equal(calls.at(-1).options.params[key], value);
      assert.equal(calls.at(-1).options.params.page, 1);
      assert.equal(page.pushes.at(-1).query.page, undefined);
    }
    assert.deepEqual(
      page.state.ratings.map((rating) => rating.value),
      ["", "10", "8", "6", "4", "2"],
    );
    page.state.changePage(3);
    await settle();
    assert.equal(calls.at(-1).options.params.page, 3);
    page.route.query = { type: "game", page: "1" };
    await settle();
    assert.equal(calls.at(-1).options.params.type, "game");
  } finally {
    page.stop();
  }
});

test("empty history, unmatched filters, API errors, unknown user and invalid URL fallbacks remain usable", async () => {
  let data = {
      ...fixture,
      reviews: [],
      total: 0,
      totalPages: 0,
      totalUserReviews: 0,
    },
    failure;
  const page = pageHarness(
    {
      get: async () => {
        if (failure) throw failure;
        return { data };
      },
    },
    { type: "bad", minScore: "oops", sort: "bad", page: "-1" },
  );
  try {
    await settle();
    assert.equal(page.state.filters.value.type, "");
    assert.equal(page.state.filters.value.page, 1);
    assert.match(await page.render(), /hasn&#39;t reviewed anything yet/);
    data = { ...data, totalUserReviews: 5 };
    await page.state.loadReviews();
    assert.match(await page.render(), /No reviews match these filters/);
    failure = Error("Network");
    await page.state.loadReviews();
    assert.match(await page.render(), /Unable to load reviews/);
    failure = { response: { status: 404 } };
    await page.state.loadReviews();
    assert.equal(page.state.error.value, "User not found");
  } finally {
    page.stop();
  }
});

test("stale review-page responses are ignored and out-of-range pages normalize without a routing loop", async () => {
  const pending = [];
  const page = pageHarness({
    get: (url, options) =>
      new Promise((resolve) => pending.push({ resolve, options })),
  });
  try {
    page.route.query = { type: "series" };
    assert.ok(pending[0].options.signal.aborted);
    pending[1].resolve({ data: fixture });
    await settle();
    pending[0].resolve({ data: { ...fixture, reviews: [] } });
    await settle();
    assert.equal(page.state.result.value.reviews.length, 3);
  } finally {
    page.stop();
  }
  const clamped = pageHarness(
    {
      get: async (url, { params }) => ({
        data: { ...fixture, page: params.page },
      }),
    },
    { page: "99" },
  );
  try {
    await settle();
    assert.equal(clamped.replaces.length, 1);
    assert.equal(clamped.route.query.page, "2");
    assert.equal(clamped.state.result.value.page, 2);
  } finally {
    clamped.stop();
  }
});

test("episode actions use primary/secondary/danger buttons, show counts, and cancel destructive confirmation", async () => {
  const file = parse(read("components/EpisodeReviews.vue")).descriptor;
  const scope = effectScope();
  let deletes = 0;
  const state = scope.run(() =>
    new Function(
      "ref",
      "computed",
      "defineProps",
      "defineEmits",
      "useAuthStore",
      "api",
      stripImports(file.scriptSetup.content) +
        "\nreturn { authStore, reviews, loaded, loading, error, expanded, showForm, deleting, confirmingDelete, deleteButton, cancelDelete, myReview, communityScore, loadReviews, toggleReviews, openReview, deleteReview };",
    )(
      ref,
      computed,
      () => ({ episode: { episodeId: 81, title: "Pilot" } }),
      () => () => {},
      () => ({ isAuthenticated: true, user: { id: 1 } }),
      {
        get: async () => ({ data: [] }),
        delete: async () => {
          deletes++;
        },
      },
    ),
  );
  const html = () =>
    renderToString(
      createSSRApp({
        setup: () => ({ ...state, episode: { episodeId: 81, title: "Pilot" } }),
        render: compile(file.template.content),
        components: {
          RouterLink,
          ReviewList: { render: () => h("div") },
          ReviewForm: { render: () => h("div") },
          Modal: { render: () => h("div") },
        },
      }),
    );
  try {
    assert.match(await html(), /action-primary/);
    assert.match(await html(), /Write a review/);
    state.reviews.value = [{ id: 9, user_id: 1, score: 8 }];
    state.loaded.value = true;
    let content = await html();
    assert.match(content, /Edit review/);
    assert.match(content, /Reviews \(1\)/);
    assert.match(content, /1 community review/);
    assert.match(content, /Delete your review of Pilot/);
    await state.deleteReview();
    assert.equal(deletes, 0);
    state.confirmingDelete.value = true;
    assert.match(await html(), /This cannot be undone/);
    state.cancelDelete();
    assert.equal(state.confirmingDelete.value, false);
    await state.deleteReview();
    assert.equal(deletes, 0);
    state.confirmingDelete.value = true;
    await state.deleteReview();
    assert.equal(deletes, 1);
    assert.equal(state.confirmingDelete.value, false);
    assert.match(file.styles[0].content, /flex-wrap: wrap/);
    assert.match(file.styles[0].content, /min-height: 42px/);
  } finally {
    scope.stop();
  }
});
