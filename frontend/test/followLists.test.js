import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parse } from "@vue/compiler-sfc";
import {
  ref,
  watch,
  nextTick,
  reactive,
  effectScope,
  compile,
  createSSRApp,
  h,
} from "vue";
import { renderToString } from "@vue/server-renderer";

const settle = () => new Promise((resolve) => setImmediate(resolve));
function mount(api, initialTab = "followers") {
  const descriptor = parse(
    fs.readFileSync(
      new URL("../src/components/FollowListDialog.vue", import.meta.url),
      "utf8",
    ),
  ).descriptor;
  const props = reactive({ username: "Alice", initialTab });
  const scope = effectScope();
  const events = [];
  let mounted;
  let unmount;
  const state = scope.run(() =>
    new Function(
      "ref",
      "watch",
      "nextTick",
      "onMounted",
      "onBeforeUnmount",
      "defineProps",
      "defineEmits",
      "api",
      descriptor.scriptSetup.content.replace(/^\s*import[\s\S]*?;\r?\n/gm, "") +
        "\nreturn { dialog, activeTab, users, page, totalPages, total, loading, error, loadPage, selectTab, moveTab, close, closeBackdrop };",
    )(
      ref,
      watch,
      nextTick,
      (cb) => {
        mounted = cb;
      },
      (cb) => {
        unmount = cb;
      },
      () => props,
      () => (event) => events.push(event),
      api,
    ),
  );
  return {
    state,
    props,
    events,
    mounted: () => mounted(),
    stop: () => {
      unmount();
      scope.stop();
    },
    html: () =>
      renderToString(
        createSSRApp({
          components: {
            RouterLink: {
              props: ["to"],
              setup:
                (props, { slots }) =>
                () =>
                  h("a", { href: props.to }, slots.default?.()),
            },
          },
          setup: () => ({ ...state, username: props.username }),
          render: compile(descriptor.template.content),
        }),
      ),
  };
}

test("connections dialog selects the clicked tab, loads public users, paginates, and navigates with canonical names", async () => {
  const calls = [];
  const dialog = mount(
    {
      get: async (url, options) => {
        calls.push({ url, options });
        return {
          data: {
            users: [{ id: 1, username: "Canonical.User", avatarUrl: null }],
            total: 21,
            totalPages: 2,
          },
        };
      },
    },
    "following",
  );
  try {
    assert.equal(dialog.state.loading.value, true);
    await settle();
    assert.equal(calls[0].url, "/users/Alice/following");
    assert.deepEqual(calls[0].options.params, { page: 1, pageSize: 20 });
    const html = await dialog.html();
    assert.match(html, /<dialog[^>]*aria-labelledby="follow-dialog-title"/);
    assert.match(html, /role="tablist"/);
    assert.match(html, /role="tabpanel"/);
    assert.match(html, /href="\/Canonical.User"/);
    dialog.state.page.value = 2;
    await settle();
    assert.equal(calls.at(-1).options.params.page, 2);
    dialog.state.selectTab("followers");
    await settle();
    assert.equal(calls.at(-1).url, "/users/Alice/followers");
    assert.equal(calls.at(-1).options.params.page, 1);
    assert.equal(calls.length, 3);
  } finally {
    dialog.stop();
  }
});

test("connections dialog ignores stale tab responses and provides errors, retry, and empty states", async () => {
  const pending = [];
  const dialog = mount({
    get: () =>
      new Promise((resolve, reject) => pending.push({ resolve, reject })),
  });
  try {
    dialog.state.selectTab("following");
    await settle();
    pending[1].reject({ response: { status: 500 } });
    await settle();
    assert.match(await dialog.html(), /Try again/);
    pending[0].resolve({
      data: { users: [{ id: 1, username: "Stale" }], total: 1, totalPages: 1 },
    });
    await settle();
    assert.deepEqual(dialog.state.users.value, []);
    const retry = dialog.state.loadPage();
    pending[2].resolve({ data: { users: [], total: 0, totalPages: 0 } });
    await retry;
    assert.match(await dialog.html(), /Not following anyone yet/);
    dialog.state.selectTab("followers");
    await settle();
    pending[3].resolve({ data: { users: [], total: 0, totalPages: 0 } });
    await settle();
    assert.match(await dialog.html(), /No followers yet/);
  } finally {
    dialog.stop();
  }
});

test("connections dialog opens modally, supports keyboard tabs and backdrop closing, and restores focus", async () => {
  const dialog = mount({
    get: async () => ({ data: { users: [], total: 0, totalPages: 0 } }),
  });
  const originalDocument = globalThis.document;
  let shown = 0;
  let closed = 0;
  let restored = 0;
  let focused;
  globalThis.document = { activeElement: { focus: () => restored++ } };
  const element = {
    showModal: () => shown++,
    close: () => closed++,
    querySelector: (selector) => ({
      focus: () => {
        focused = selector;
      },
    }),
    getBoundingClientRect: () => ({
      left: 20,
      right: 200,
      top: 20,
      bottom: 200,
    }),
  };
  dialog.state.dialog.value = element;
  try {
    dialog.mounted();
    assert.equal(shown, 1);
    let prevented = false;
    await dialog.state.moveTab({
      key: "ArrowRight",
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.equal(prevented, true);
    assert.equal(dialog.state.activeTab.value, "following");
    assert.equal(focused, "#follow-tab-following");
    dialog.state.closeBackdrop({
      target: dialog.state.dialog.value,
      clientX: 100,
      clientY: 100,
    });
    assert.deepEqual(dialog.events, []);
    dialog.state.closeBackdrop({
      target: dialog.state.dialog.value,
      clientX: 10,
      clientY: 10,
    });
    assert.deepEqual(dialog.events, ["close"]);
    assert.equal(closed, 1);
  } finally {
    dialog.stop();
    globalThis.document = originalDocument;
  }
  assert.equal(restored, 1);
});

test("profile settings retains legacy bio content while saving avatar-only changes and displays backend validation errors", async () => {
  const descriptor = parse(
    fs.readFileSync(
      new URL(
        "../src/components/settings/ProfileSettings.vue",
        import.meta.url,
      ),
      "utf8",
    ),
  ).descriptor;
  const legacyBio = "x".repeat(500);
  const calls = [];
  const api = {
    get: async (url) => {
      assert.equal(url, "/auth/me");
      return { data: { bio: legacyBio, avatar_url: "old-avatar" } };
    },
    put: async (url, body) => calls.push({ url, body }),
  };
  const scope = effectScope();
  const state = scope.run(() =>
    new Function(
      "ref",
      "watch",
      "onMounted",
      "useAuthStore",
      "api",
      descriptor.scriptSetup.content.replace(/^\s*import[\s\S]*?;\r?\n/gm, "") +
        "\nreturn { bio, avatarUrl, profileError, profileSuccess, profileSaving, loadCurrentProfile, saveProfile };",
    )(
      ref,
      watch,
      () => {},
      () => ({ user: { username: "Alice" } }),
      api,
    ),
  );
  try {
    await state.loadCurrentProfile();
    assert.equal(state.bio.value, legacyBio);
    state.avatarUrl.value = "new-avatar";
    await state.saveProfile();
    assert.deepEqual(calls[0], {
      url: "/users/me",
      body: { avatarUrl: "new-avatar" },
    });
    state.bio.value = "New bio";
    api.put = async () => {
      throw {
        response: {
          data: { error: "Bio contains language that is not allowed" },
        },
      };
    };
    await state.saveProfile();
    assert.equal(
      state.profileError.value,
      "Bio contains language that is not allowed",
    );
    const html = await renderToString(
      createSSRApp({
        components: { TopFiveEditor: { render: () => h("div") } },
        setup: () => ({ ...state, authStore: { user: { username: "Alice" } } }),
        render: compile(descriptor.template.content),
      }),
    );
    assert.match(html, /7 \/ 280/);
    assert.match(html, /aria-describedby="profile-bio-count"/);
    assert.match(html, /role="alert"/);
  } finally {
    scope.stop();
  }
});
