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
const descriptors = new Map();
function descriptor(file) {
  if (!descriptors.has(file))
    descriptors.set(
      file,
      parse(fs.readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"))
        .descriptor,
    );
  return descriptors.get(file);
}
function setup(file, exports, dependencies = {}) {
  const scope = effectScope();
  const bindings = {
    ref,
    reactive,
    computed,
    watch,
    defineProps: () => ({}),
    defineEmits: () => () => {},
    ...dependencies,
  };
  const source = descriptor(file).scriptSetup.content.replace(
    /^\s*import[\s\S]*?;\r?\n/gm,
    "",
  );
  const state = scope.run(() =>
    new Function(...Object.keys(bindings), `${source}\nreturn { ${exports} };`)(
      ...Object.values(bindings),
    ),
  );
  return { state, stop: () => scope.stop() };
}
const stubs = Object.fromEntries(
  [
    "NavBar",
    "Footer",
    "ReviewList",
    "StarRating",
    "FollowButton",
    "GenreRadar",
  ].map((name) => [
    name,
    { render: () => h("div", { "data-component": name }) },
  ]),
);
stubs.RouterLink = {
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
              : props.to.path ||
                `/${props.to.params?.username}${props.to.name === "user-reviews" ? "/reviews" : ""}`,
        },
        slots.default?.(),
      ),
};
stubs.Modal = {
  setup:
    (_, { slots }) =>
    () =>
      h("div", slots.default?.()),
};
stubs.ReviewForm = {
  props: ["episodeId", "existingReview"],
  setup: (props) => () =>
    h(
      "div",
      { "data-episode": props.episodeId },
      props.existingReview ? "Edit your review" : "Write a review",
    ),
};
stubs.EpisodeReviews = { render: () => h("button", "Write an episode review") };
stubs.SeriesSeasons = {
  render: () => h("section", "Seasons and episode reviews"),
};
function render(file, state, props = {}) {
  return renderToString(
    createSSRApp({
      components: stubs,
      setup: () => ({ existingReview: null, ...props, ...state }),
      render: compile(descriptor(file).template.content),
    }),
  );
}

test("ReviewForm submits exactly one internal target, preserves edits and surfaces errors", async () => {
  for (const target of [{ mediaId: 42 }, { episodeId: 81 }]) {
    const calls = [],
      emitted = [];
    const props = reactive({ ...target, existingReview: null });
    const form = setup(
      "components/ReviewForm.vue",
      "score, comment, saving, error, submit, emit",
      {
        defineProps: () => props,
        defineEmits:
          () =>
          (...args) =>
            emitted.push(args),
        api: {
          post: async (url, body) => {
            calls.push({ url, body });
            return { data: { id: 9 } };
          },
          put: async (url, body) => {
            calls.push({ url, body });
            return { data: { id: 9 } };
          },
        },
      },
    );
    try {
      await form.state.submit();
      assert.equal(calls.length, 0, "Zero means no rating selected");
      assert.match(form.state.error.value, /Pick a star rating/);
      form.state.score.value = 8.5;
      form.state.comment.value = "Great episode";
      await form.state.submit();
      assert.deepEqual(calls[0], {
        url: "/reviews",
        body: { ...target, score: 8.5, comment: "Great episode" },
      });
      assert.equal(emitted[0][0], "saved");
      props.existingReview = { id: 9, score: "7.0", comment: "Existing" };
      await settle();
      assert.equal(form.state.score.value, 7);
      assert.match(
        await render("components/ReviewForm.vue", form.state, props),
        /Edit your review/,
      );
      await form.state.submit();
      assert.deepEqual(calls[1], {
        url: "/reviews/9",
        body: { score: 7, comment: "Existing" },
      });
    } finally {
      form.stop();
    }
  }
  for (const props of [{}, { mediaId: 42, episodeId: 81 }]) {
    const form = setup("components/ReviewForm.vue", "score, error, submit", {
      defineProps: () => props,
      api: { post: () => assert.fail("Invalid target submitted") },
    });
    form.state.score.value = 8;
    await form.state.submit();
    assert.match(form.state.error.value, /exactly one/);
    form.stop();
  }
  const form = setup(
    "components/ReviewForm.vue",
    "score, comment, saving, error, submit, emit",
    {
      defineProps: () => ({ episodeId: 81 }),
      api: {
        post: async () => {
          throw { response: { data: { error: "Duplicate review" } } };
        },
      },
    },
  );
  form.state.score.value = 8;
  await form.state.submit();
  assert.equal(form.state.error.value, "Duplicate review");
  assert.equal(form.state.saving.value, false);
  assert.match(
    await render("components/ReviewForm.vue", form.state, { episodeId: 81 }),
    /role="alert"/,
  );
  form.stop();
});

test("seasons load lazily, expose loading/error states, retry, and reuse cached internal episode IDs", async () => {
  const props = {
    seriesId: "99",
    seasons: [
      { seasonNumber: 1, name: "Season 1", episodeCount: 1 },
      { seasonNumber: 2, name: "Season 2", episodeCount: 1 },
    ],
  };
  const calls = [];
  let resolve;
  let failing = false;
  const season = setup(
    "components/SeriesSeasons.vue",
    "seasonStates, loadSeason, toggleSeason, formatAirDate, emit",
    {
      defineProps: () => props,
      api: {
        get: (url) => {
          calls.push(url);
          if (failing) return Promise.reject(Error("Unavailable"));
          return new Promise((done) => {
            resolve = done;
          });
        },
      },
    },
  );
  try {
    assert.equal(calls.length, 0);
    assert.match(
      await render("components/SeriesSeasons.vue", season.state, props),
      /aria-expanded="false"/,
    );
    const opening = season.state.toggleSeason(1);
    assert.equal(season.state.seasonStates[1].loading, true);
    assert.match(
      await render("components/SeriesSeasons.vue", season.state, props),
      /Loading episodes/,
    );
    resolve({
      data: {
        seasonNumber: 1,
        episodes: [
          {
            episodeId: 81,
            episodeNumber: 1,
            title: "Pilot",
            airDate: "2024-01-01",
            stillUrl: null,
            overview: "Episode overview",
          },
        ],
      },
    });
    await opening;
    const html = await render(
      "components/SeriesSeasons.vue",
      season.state,
      props,
    );
    assert.match(html, /E01 · Pilot/);
    assert.match(html, /Write an episode review/);
    assert.match(html, /aria-expanded="true"/);
    assert.equal(season.state.seasonStates[1].data.episodes[0].episodeId, 81);
    await season.state.toggleSeason(1);
    await season.state.toggleSeason(1);
    assert.deepEqual(calls, ["/media/series/99/season/1"]);
    failing = true;
    await season.state.toggleSeason(2);
    assert.match(
      await render("components/SeriesSeasons.vue", season.state, props),
      /Unable to load this season/,
    );
    failing = false;
    const retry = season.state.loadSeason(2);
    resolve({ data: { episodes: [] } });
    await retry;
    assert.equal(season.state.seasonStates[2].error, "");
    assert.equal(calls.length, 3);
  } finally {
    season.stop();
  }
});

test("episode reviews identify own review, edit with internal episodeId, refresh after save/delete and emit score changes", async () => {
  const props = {
    episode: { episodeId: 81, episodeNumber: 1, title: "Pilot" },
  };
  const authStore = { user: { id: 1 }, isAuthenticated: true };
  const calls = [],
    emitted = [];
  let rows = [
    { id: 9, user_id: 1, score: "8.0" },
    { id: 10, user_id: 2, score: "6.0" },
  ];
  const episode = setup(
    "components/EpisodeReviews.vue",
    "authStore, reviews, loaded, loading, error, expanded, showForm, deleting, confirmingDelete, deleteButton, cancelDelete, myReview, communityScore, loadReviews, toggleReviews, openReview, onSaved, deleteReview",
    {
      defineProps: () => props,
      defineEmits: () => (name) => emitted.push(name),
      useAuthStore: () => authStore,
      api: {
        get: async (url) => {
          calls.push(url);
          return { data: rows };
        },
        delete: async (url) => {
          calls.push(url);
          rows = [];
        },
      },
    },
  );
  try {
    assert.equal(calls.length, 0);
    await episode.state.openReview();
    assert.equal(episode.state.myReview.value.id, 9);
    assert.equal(episode.state.communityScore.value, "7.0");
    let html = await render(
      "components/EpisodeReviews.vue",
      episode.state,
      props,
    );
    assert.match(html, /Edit your review/);
    assert.match(html, /data-episode="81"/);
    rows = [{ id: 9, user_id: 1, score: "10.0" }];
    await episode.state.onSaved();
    assert.equal(episode.state.showForm.value, false);
    assert.equal(episode.state.expanded.value, true);
    assert.equal(episode.state.communityScore.value, "10.0");
    assert.deepEqual(emitted, ["changed"]);
    await episode.state.toggleReviews();
    await episode.state.toggleReviews();
    assert.equal(calls.length, 2, "Reopening loaded reviews must not refetch");
    await episode.state.deleteReview();
    assert.equal(calls.length, 2, "Delete requires confirmation");
    episode.state.confirmingDelete.value = true;
    assert.match(
      await render("components/EpisodeReviews.vue", episode.state, props),
      /Confirm delete/,
    );
    await episode.state.deleteReview();
    assert.ok(calls.includes("/reviews/9"));
    assert.equal(episode.state.communityScore.value, null);
    assert.equal(episode.state.myReview.value, null);
    assert.deepEqual(emitted, ["changed", "changed"]);
    html = await render("components/EpisodeReviews.vue", episode.state, props);
    assert.match(html, /No ratings yet/);
  } finally {
    episode.stop();
  }
});

test("anonymous users can view episode reviews; failed requests remain retryable", async () => {
  let failing = true;
  const props = { episode: { episodeId: 81 } };
  const episode = setup(
    "components/EpisodeReviews.vue",
    "authStore, reviews, loaded, loading, error, expanded, showForm, deleting, confirmingDelete, deleteButton, cancelDelete, myReview, communityScore, loadReviews, toggleReviews, openReview",
    {
      defineProps: () => props,
      useAuthStore: () => ({ isAuthenticated: false }),
      api: {
        get: async () => {
          if (failing) throw Error("Unavailable");
          return { data: [] };
        },
      },
    },
  );
  try {
    await episode.state.openReview();
    assert.equal(episode.state.showForm.value, false);
    await episode.state.toggleReviews();
    assert.equal(episode.state.loaded.value, false);
    assert.match(
      await render("components/EpisodeReviews.vue", episode.state, props),
      /Log in to review this episode/,
    );
    failing = false;
    await episode.state.loadReviews();
    assert.equal(episode.state.loaded.value, true);
    assert.equal(episode.state.error.value, "");
  } finally {
    episode.stop();
  }
});

test("movie/game retain direct reviews, series use episodes, and provider/community scores remain distinct", async () => {
  for (const type of ["movie", "game", "series"]) {
    const calls = [];
    let communityScore = null;
    const route = reactive({ name: `${type}-detail`, params: { id: "99" } });
    const page = setup(
      "views/MediaDetailsView.vue",
      "authStore, reviews, showForm, detail, loading, error, watchlistStatus, watchlistLoading, reviewError, communityScoreError, deletingReview, directReviewsAllowed, providerName, myReview, loadReviews, onReviewSaved, refreshCommunityScore, deleteMyReview, toggleWatchlist",
      {
        useRoute: () => route,
        useAuthStore: () => ({ user: { id: 1 }, isAuthenticated: true }),
        api: {
          get: async (url) => {
            calls.push(url);
            if (url.startsWith("/media/"))
              return {
                data: {
                  mediaId: 42,
                  externalId: "99",
                  type,
                  source: type === "game" ? "rawg" : "tmdb",
                  title: "Example",
                  score: 8.7,
                  communityScore,
                  seasons: [],
                },
              };
            if (url.startsWith("/reviews/")) return { data: [] };
            return { data: { inWatchlist: false } };
          },
        },
      },
    );
    try {
      await settle();
      let html = await render("views/MediaDetailsView.vue", page.state);
      assert.equal(page.state.directReviewsAllowed.value, type !== "series");
      assert.equal(calls.includes("/reviews/media/42"), type !== "series");
      if (type === "series") {
        assert.doesNotMatch(html, /Write a review/);
        assert.match(html, /Seasons and episode reviews/);
      } else assert.match(html, /Write a review/);
      assert.match(html, type === "game" ? /RAWG/ : /TMDB/);
      assert.match(html, /★ 8.7/);
      assert.match(html, /Your Favorite Profile/);
      assert.match(html, /No community ratings yet/);
      communityScore = 7.5;
      await page.state.onReviewSaved();
      assert.equal(page.state.detail.value.communityScore, 7.5);
      html = await render("views/MediaDetailsView.vue", page.state);
      assert.match(html, /★ 7.5/);
      assert.match(html, /★ 8.7/);
    } finally {
      page.stop();
    }
  }
});

test("public profile renders recent episode reviews alongside media reviews", async () => {
  const profile = ref({
    username: "alice",
    createdAt: "2024-01-01",
    stats: { reviewCount: 2, avgScore: 8 },
    followCounts: { followers: 0, following: 0 },
    genreBreakdown: [],
    topFive: [],
    recentReviews: [
      {
        id: 1,
        title: "Series",
        type: "series",
        episode_id: 81,
        episode_title: "Pilot",
        season_number: 1,
        episode_number: 3,
        score: 8,
      },
      { id: 2, title: "Movie", type: "movie", score: 7 },
    ],
  });
  const html = await render("views/ProfileView.vue", {
    authStore: { isAuthenticated: false },
    profile,
    loading: ref(false),
    error: ref(""),
    isOwnProfile: ref(false),
    formatDate: () => "Jan 1, 2024",
    updateFollowing: () => {},
  });
  assert.match(html, /S01E03 · Pilot/);
  assert.match(html, /Movie/);
  assert.match(html, /Series/);
  assert.match(html, /href="\/alice\/reviews"/);
  assert.match(html, /View all reviews/);
});

test("failed series score refresh has its own retryable error and preserves the last score", async () => {
  let failing = false;
  const page = setup(
    "views/MediaDetailsView.vue",
    "detail, communityScoreError, refreshCommunityScore",
    {
      useRoute: () => ({ name: "series-detail", params: { id: "99" } }),
      useAuthStore: () => ({ isAuthenticated: false }),
      api: {
        get: async () => {
          if (failing) throw Error("Provider unavailable");
          return {
            data: {
              type: "series",
              externalId: "99",
              mediaId: 42,
              communityScore: 8,
            },
          };
        },
      },
    },
  );
  try {
    await settle();
    failing = true;
    await page.state.refreshCommunityScore();
    assert.match(
      page.state.communityScoreError.value,
      /could not be refreshed/,
    );
    assert.equal(page.state.detail.value.communityScore, 8);
    failing = false;
    await page.state.refreshCommunityScore();
    assert.equal(page.state.communityScoreError.value, "");
  } finally {
    page.stop();
  }
});
