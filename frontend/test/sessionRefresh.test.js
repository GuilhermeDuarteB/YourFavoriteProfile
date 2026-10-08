import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createPinia, defineStore } from "pinia";

function createStore(api) {
  const entries = new Map([
    ["user", JSON.stringify({ id: 2, username: "OldName" })],
    ["token", "same-user-id-token"],
  ]);
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const source = fs
    .readFileSync(
      new URL("../src/stores/authStore.js", import.meta.url),
      "utf8",
    )
    .replace(/^\s*import[\s\S]*?;\r?\n/gm, "")
    .replace("export const", "const");
  const useStore = new Function(
    "defineStore",
    "api",
    "localStorage",
    source + "\nreturn useAuthStore;",
  )(defineStore, api, storage);
  return { store: useStore(createPinia()), entries };
}

test("restored sessions refresh canonical username without replacing the valid token", async () => {
  const user = { id: 2, username: "user2", email: "test@example.com" };
  const { store, entries } = createStore({
    get: async (url) => {
      assert.equal(url, "/auth/me");
      return { data: user };
    },
  });
  await store.refreshSession();
  assert.equal(store.user.username, "user2");
  assert.equal(store.token, "same-user-id-token");
  assert.deepEqual(JSON.parse(entries.get("user")), user);
});

test("late account refresh cannot restore a logged-out or replaced session", async () => {
  let resolve;
  const { store } = createStore({
    get: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  let pending = store.refreshSession();
  store.logout();
  resolve({ data: { id: 2, username: "user2" } });
  await pending;
  assert.equal(store.user, null);
  store.setSessions({ id: 2, username: "user2" }, "old-token");
  pending = store.refreshSession();
  store.setSessions({ id: 3, username: "Alice" }, "new-token");
  resolve({ data: { id: 2, username: "user2" } });
  await pending;
  assert.equal(store.user.id, 3);
  assert.equal(store.token, "new-token");
});

test("account refresh keeps a session on transient failure and skips signed-out users", async () => {
  let calls = 0;
  const { store } = createStore({
    get: async () => {
      calls++;
      throw new Error("offline");
    },
  });
  const warn = console.warn;
  console.warn = () => {};
  try {
    await store.refreshSession();
  } finally {
    console.warn = warn;
  }
  assert.equal(store.user.username, "OldName");
  assert.equal(store.token, "same-user-id-token");
  store.logout();
  await store.refreshSession();
  assert.equal(calls, 1);
});
