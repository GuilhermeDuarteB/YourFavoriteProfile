<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import api from "../api/axios.js";

const props = defineProps({
  username: { type: String, required: true },
  initialTab: { type: String, default: "followers" },
});
const emit = defineEmits(["close"]);
const dialog = ref(null);
const activeTab = ref(props.initialTab);
const users = ref([]);
const page = ref(1);
const totalPages = ref(0);
const total = ref(0);
const loading = ref(false);
const error = ref("");
let requestVersion = 0;
let previousFocus;

async function loadPage() {
  const version = ++requestVersion;
  loading.value = true;
  error.value = "";
  users.value = [];
  try {
    const { data } = await api.get(
      `/users/${encodeURIComponent(props.username)}/${activeTab.value}`,
      { params: { page: page.value, pageSize: 20 } },
    );
    if (version !== requestVersion) return;
    users.value = data.users;
    total.value = data.total;
    totalPages.value = data.totalPages;
  } catch (err) {
    if (version !== requestVersion) return;
    error.value =
      err.response?.status === 404
        ? "This profile is no longer available."
        : "Unable to load this list. Please try again.";
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

function selectTab(tab) {
  if (activeTab.value === tab) return;
  activeTab.value = tab;
  page.value = 1;
}

async function moveTab(event) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tab =
    event.key === "Home"
      ? "followers"
      : event.key === "End"
        ? "following"
        : activeTab.value === "followers"
          ? "following"
          : "followers";
  selectTab(tab);
  await nextTick();
  dialog.value?.querySelector(`#follow-tab-${tab}`)?.focus();
}

function close() {
  requestVersion++;
  dialog.value?.close();
  emit("close");
}

function closeBackdrop(event) {
  if (event.target !== dialog.value) return;
  const bounds = dialog.value.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    close();
}

watch([() => props.username, activeTab, page], loadPage, { immediate: true });
onMounted(() => {
  previousFocus = document.activeElement;
  dialog.value.showModal();
});
onBeforeUnmount(() => {
  requestVersion++;
  dialog.value?.close();
  previousFocus?.focus();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="follow-dialog"
    aria-labelledby="follow-dialog-title"
    @cancel.prevent="close"
    @click="closeBackdrop"
  >
    <header class="dialog-heading">
      <h2 id="follow-dialog-title">{{ username }}'s connections</h2>
      <button
        type="button"
        class="close-button"
        aria-label="Close connections"
        autofocus
        @click="close"
      >
        ×
      </button>
    </header>
    <div
      class="tabs"
      role="tablist"
      aria-label="Profile connections"
      @keydown="moveTab"
    >
      <button
        v-for="tab in ['followers', 'following']"
        :id="`follow-tab-${tab}`"
        :key="tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab"
        :tabindex="activeTab === tab ? 0 : -1"
        aria-controls="follow-list-panel"
        @click="selectTab(tab)"
      >
        {{ tab === "followers" ? "Followers" : "Following" }}
      </button>
    </div>
    <section
      id="follow-list-panel"
      role="tabpanel"
      :aria-labelledby="`follow-tab-${activeTab}`"
      :aria-busy="loading"
      tabindex="0"
    >
      <p v-if="loading" class="state" role="status">
        Loading {{ activeTab }}...
      </p>
      <div v-else-if="error" class="state">
        <p role="alert">{{ error }}</p>
        <button type="button" @click="loadPage">Try again</button>
      </div>
      <p v-else-if="users.length === 0" class="state">
        {{
          total === 0
            ? activeTab === "followers"
              ? "No followers yet."
              : "Not following anyone yet."
            : "No users on this page."
        }}
      </p>
      <ul v-else class="user-list">
        <li v-for="user in users" :key="user.id">
          <router-link
            :to="`/${encodeURIComponent(user.username)}`"
            @click="close"
          >
            <img
              v-if="user.avatarUrl"
              :src="user.avatarUrl"
              alt=""
              class="user-avatar"
            />
            <span v-else class="user-avatar" aria-hidden="true">{{
              user.username[0]?.toUpperCase()
            }}</span>
            <span class="username">{{ user.username }}</span>
          </router-link>
        </li>
      </ul>
      <nav
        v-if="!loading && !error && (totalPages > 1 || page > 1)"
        class="pagination"
        aria-label="Connections pages"
      >
        <button type="button" :disabled="page <= 1" @click="page--">
          Previous
        </button>
        <span role="status"
          >Page {{ page }} of {{ Math.max(page, totalPages) }}</span
        >
        <button type="button" :disabled="page >= totalPages" @click="page++">
          Next
        </button>
      </nav>
    </section>
  </dialog>
</template>

<style scoped>
.follow-dialog {
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  box-sizing: border-box;
  overflow-y: auto;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-card);
  color: var(--text);
}
.follow-dialog::backdrop {
  background: rgba(0, 0, 0, 0.72);
}
.dialog-heading {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;
}
h2 {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 18px;
  margin: 0;
}
button {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.close-button {
  font-size: 24px;
  padding: 0 10px;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
button:focus-visible,
a:focus-visible,
[role="tabpanel"]:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 3px;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tabs button {
  flex: 1;
}
.tabs [aria-selected="true"] {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}
.state {
  color: var(--text-mute);
  padding: 20px 0;
  font-size: 14px;
  text-align: center;
}
.user-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.user-list a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-radius: 8px;
  color: var(--text);
  text-decoration: none;
}
.user-list a:hover {
  background: var(--bg);
}
.user-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--navy);
  font-weight: 700;
}
.username {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 18px;
  font-size: 12px;
}
@media (max-width: 400px) {
  .follow-dialog {
    padding: 16px;
  }
  .pagination {
    flex-wrap: wrap;
  }
}
</style>
