import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";

const readScript = (path) =>
  fs
    .readFileSync(new URL(path, import.meta.url), "utf8")
    .match(/<script setup>([\s\S]*?)<\/script>/)[1]
    .replace(/^\s*import[\s\S]*?;\r?\n/gm, "");
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("Settings defaults to Profile and keeps sections synchronized with the query", async () => {
  const route = reactive({ query: {}, hash: "" });
  const pushes = [];
  const replaces = [];
  const source = readScript("../src/views/SettingsView.vue");
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "computed",
      "nextTick",
      "watch",
      "useRoute",
      "useRouter",
      source + "\nreturn { activeSection, normalizeSection, selectSection };",
    )(
      computed,
      nextTick,
      watch,
      () => route,
      () => ({
        push: (value) => pushes.push(value),
        replace: (value) => replaces.push(value),
      }),
    ),
  );

  try {
    assert.equal(state.activeSection.value, "profile");
    state.selectSection("account");
    assert.deepEqual(pushes[0], {
      name: "settings",
      query: { section: "account" },
      hash: "",
    });

    route.query = { section: "security" };
    await nextTick();
    assert.equal(state.activeSection.value, "security");

    route.query = { section: "not-a-section", filter: "keep" };
    await nextTick();
    assert.equal(state.activeSection.value, "profile");
    assert.deepEqual(replaces.at(-1), {
      name: "settings",
      query: { section: "profile", filter: "keep" },
      hash: "",
    });
    assert.equal(state.normalizeSection("danger"), "danger");
    assert.equal(state.normalizeSection("invalid"), "profile");
  } finally {
    scope.stop();
  }
});

test("TopFiveEditor loads existing items, resolves external IDs, prevents duplicates, and saves internal IDs", async () => {
  const calls = [];
  const api = {
    get: async (url, options) => {
      calls.push({ method: "get", url, options });
      if (url === "/top-five/alice") {
        return {
          data: [
            {
              rank: 1,
              media_id: 42,
              external_id: "550",
              type: "movie",
              title: "Fight Club",
              poster_url: null,
            },
          ],
        };
      }
      if (url === "/media/discover") {
        return {
          data: {
            results: [
              {
                id: 99,
                type: "series",
                title: "Example Series",
                posterUrl: null,
              },
            ],
          },
        };
      }
      if (url === "/media/series/99") {
        return {
          data: {
            mediaId: 81,
            externalId: "99",
            type: "series",
            title: "Example Series",
            posterUrl: null,
          },
        };
      }
      if (url === "/media/movie/550") {
        return {
          data: {
            mediaId: 42,
            externalId: "550",
            type: "movie",
            title: "Fight Club",
            posterUrl: null,
          },
        };
      }
      throw new Error(`Unexpected GET ${url}`);
    },
    put: async (url, body) => {
      calls.push({ method: "put", url, body });
      return {
        data: body.items.map((item) => ({
          ...item,
          media_id: item.mediaId,
          external_id: String(item.mediaId),
          type: "movie",
          title: "Saved title",
        })),
      };
    },
  };
  let unmount;
  const props = { username: "alice" };
  const source = readScript("../src/components/settings/TopFiveEditor.vue");
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "computed",
      "ref",
      "watch",
      "onBeforeUnmount",
      "defineProps",
      "defineEmits",
      "api",
      source +
        "\nreturn { items, searchQuery, searchResults, searchError, saveError, saveSuccess, loadTopFive, searchMedia, selectSearchResult, saveTopFive };",
    )(
      computed,
      ref,
      watch,
      (callback) => {
        unmount = callback;
      },
      () => props,
      () => () => {},
      api,
    ),
  );

  try {
    await settle();
    assert.deepEqual(
      state.items.value.map(({ mediaId, rank }) => ({ mediaId, rank })),
      [{ mediaId: 42, rank: 1 }],
    );

    state.searchQuery.value = "example";
    await new Promise((resolve) => setTimeout(resolve, 380));
    await settle();
    assert.equal(state.searchResults.value[0].id, 99);
    assert.deepEqual(
      calls.find((call) => call.url === "/media/discover").options.params,
      {
        query: "example",
        types: "movie,series,game",
        page: 1,
      },
    );

    await state.selectSearchResult(state.searchResults.value[0]);
    assert.ok(calls.some((call) => call.url === "/media/series/99"));
    assert.deepEqual(
      state.items.value.map(({ mediaId, rank }) => ({ mediaId, rank })),
      [
        { mediaId: 42, rank: 1 },
        { mediaId: 81, rank: 2 },
      ],
    );

    state.searchResults.value = [
      { id: 550, type: "movie", title: "Fight Club" },
    ];
    await state.selectSearchResult(state.searchResults.value[0]);
    assert.match(state.searchError.value, /already in your Top 5/);

    await state.saveTopFive();
    const saveCall = calls.find((call) => call.method === "put");
    assert.deepEqual(saveCall.body, {
      items: [
        { mediaId: 42, rank: 1 },
        { mediaId: 81, rank: 2 },
      ],
    });
    assert.equal(state.saveSuccess.value, "Top 5 updated.");

    state.items.value.push({
      mediaId: 42,
      rank: 3,
      externalId: "550",
      type: "movie",
      title: "Duplicate",
    });
    const putCount = calls.filter((call) => call.method === "put").length;
    await state.saveTopFive();
    assert.match(state.saveError.value, /unique media/);
    assert.equal(
      calls.filter((call) => call.method === "put").length,
      putCount,
    );
  } finally {
    unmount?.();
    scope.stop();
  }
});

test("Account settings preserve backend field names, local user updates, and password-error behavior", async () => {
  const saved = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    setItem(key, value) {
      saved.set(key, value);
    },
  };
  const auth = { user: { username: "alice", email: "alice@example.com" } };
  const calls = [];
  const routerCalls = [];
  const api = {
    put: async (url, body) => {
      calls.push({ url, body });
      if (url.includes("username"))
        return { data: { username: body.newUsername } };
      return { data: { email: body.newEmail } };
    },
  };
  const source = readScript("../src/components/settings/AccountSettings.vue");
  const state = new Function(
    "ref",
    "useAuthStore",
    "useRouter",
    "api",
    source +
      "\nreturn { newUsername, usernamePassword, newEmail, emailPassword, changeUsername, changeEmail, usernameError, emailError };",
  )(
    ref,
    () => auth,
    () => ({ replace: (value) => routerCalls.push(value) }),
    api,
  );

  try {
    state.newUsername.value = "new-alice";
    state.usernamePassword.value = "password";
    await state.changeUsername();
    assert.deepEqual(calls[0], {
      url: "/auth/me/username",
      body: { newUsername: "new-alice", password: "password" },
    });
    assert.equal(auth.user.username, "new-alice");
    assert.deepEqual(routerCalls[0], {
      name: "settings",
      query: { section: "account" },
    });

    state.newEmail.value = "new@example.com";
    state.emailPassword.value = "password";
    await state.changeEmail();
    assert.deepEqual(calls[1], {
      url: "/auth/me/email",
      body: { newEmail: "new@example.com", password: "password" },
    });
    assert.equal(auth.user.email, "new@example.com");
    assert.equal(JSON.parse(saved.get("user")).email, "new@example.com");

    api.put = async () => {
      throw { response: { data: { error: "Incorrect password" } } };
    };
    await state.changeEmail();
    assert.equal(state.emailError.value, "Incorrect password");
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test("Security logout clears the session and navigates home", () => {
  let loggedOut = 0;
  const pushed = [];
  const source = readScript("../src/components/settings/SecuritySettings.vue");
  const state = new Function(
    "useAuthStore",
    "useRouter",
    source + "\nreturn { handleLogout };",
  )(
    () => ({
      logout: () => {
        loggedOut += 1;
      },
    }),
    () => ({ push: (value) => pushed.push(value) }),
  );
  state.handleLogout();
  assert.equal(loggedOut, 1);
  assert.deepEqual(pushed, ["/"]);
});
