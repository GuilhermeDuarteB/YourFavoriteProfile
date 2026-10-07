<script setup>
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";
import MediaCard from "../components/MediaCard.vue";

const route = useRoute();
const query = computed(() =>
  typeof route.query.q === "string" ? route.query.q.trim() : "",
);
const media = ref([]);
const users = ref([]);
const mediaLoading = ref(false);
const usersLoading = ref(false);
const loading = computed(() => mediaLoading.value || usersLoading.value);
const mediaError = ref("");
const usersError = ref("");
const mediaWarnings = ref([]);
const activeTab = ref("all");
const tabs = [
  { value: "all", label: "All" },
  { value: "media", label: "Media" },
  { value: "users", label: "Users" },
];
let activeRequest;

function isCurrent(request) {
  return request === activeRequest && !request.controller.signal.aborted;
}

async function loadMedia(request = activeRequest) {
  if (!request?.query || !isCurrent(request) || mediaLoading.value) return;
  mediaLoading.value = true;
  mediaError.value = "";
  try {
    const res = await api.get("/media/discover", {
      params: { query: request.query },
      signal: request.controller.signal,
    });
    if (!isCurrent(request)) return;
    media.value = res.data.results;
    mediaWarnings.value = res.data.warnings || [];
  } catch {
    if (isCurrent(request))
      mediaError.value = "Unable to load media results. Please try again.";
  } finally {
    if (isCurrent(request)) mediaLoading.value = false;
  }
}

async function loadUsers(request = activeRequest) {
  if (!request?.query || !isCurrent(request) || usersLoading.value) return;
  usersLoading.value = true;
  usersError.value = "";
  try {
    const res = await api.get("/users/search", {
      params: { q: request.query },
      signal: request.controller.signal,
    });
    if (isCurrent(request)) users.value = res.data;
  } catch {
    if (isCurrent(request))
      usersError.value = "Unable to load user results. Please try again.";
  } finally {
    if (isCurrent(request)) usersLoading.value = false;
  }
}

watch(
  query,
  (q, previousQuery, onCleanup) => {
    const request = { query: q, controller: new AbortController() };
    activeRequest = request;
    onCleanup(() => request.controller.abort());
    media.value = [];
    users.value = [];
    mediaError.value = "";
    usersError.value = "";
    mediaWarnings.value = [];
    mediaLoading.value = false;
    usersLoading.value = false;
    activeTab.value = "all";
    if (!q) return;
    void loadMedia(request);
    void loadUsers(request);
  },
  { immediate: true, flush: "sync" },
);
</script>

<template>
  <div>
    <NavBar />
    <main class="search-results">
      <h1>{{ query ? `Search results for “${query}”` : "Search" }}</h1>
      <p v-if="!query" class="state-message">
        Search for movies, series, games, or users using the search bar above.
      </p>
      <template v-else>
        <nav class="search-tabs" aria-label="Search result categories">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            :class="{ active: activeTab === tab.value }"
            :aria-pressed="activeTab === tab.value"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </nav>
        <section
          v-if="activeTab !== 'users'"
          aria-labelledby="media-results-title"
          :aria-busy="mediaLoading"
        >
          <h2 id="media-results-title">Movies, series, and games</h2>
          <p
            v-for="warning in mediaWarnings"
            :key="warning"
            class="query-label"
            role="status"
          >
            {{ warning }}
          </p>
          <p v-if="mediaLoading" class="state-message" role="status">
            Loading media...
          </p>
          <p v-else-if="mediaError" class="state-message" role="alert">
            {{ mediaError }}
            <button type="button" class="retry" @click="loadMedia()">
              Retry media
            </button>
          </p>
          <p v-else-if="!media.length" class="state-message">No media found.</p>
          <div v-else class="media-grid">
            <MediaCard
              v-for="item in media"
              :key="`${item.type}-${item.id}`"
              v-bind="item"
            />
          </div>
        </section>
        <section
          v-if="activeTab !== 'media'"
          aria-labelledby="user-results-title"
          :aria-busy="usersLoading"
        >
          <h2 id="user-results-title">Users</h2>
          <p v-if="usersLoading" class="state-message" role="status">
            Loading users...
          </p>
          <p v-else-if="usersError" class="state-message" role="alert">
            {{ usersError }}
            <button type="button" class="retry" @click="loadUsers()">
              Retry users
            </button>
          </p>
          <p v-else-if="!users.length" class="state-message">No users found.</p>
          <div v-else class="users-grid">
            <router-link
              v-for="user in users"
              :key="user.id"
              :to="{ name: 'profile', params: { username: user.username } }"
              class="user-card"
            >
              <img
                v-if="user.avatar_url"
                :src="user.avatar_url"
                alt=""
                class="avatar"
              />
              <span v-else class="avatar">{{
                user.username[0].toUpperCase()
              }}</span>
              <span class="username">{{ user.username }}</span>
            </router-link>
          </div>
        </section>
      </template>
    </main>
    <Footer />
  </div>
</template>

<style scoped>
.search-results {
  padding: 32px 56px 48px;
  min-width: 0;
}
h1 {
  margin-bottom: 12px;
}
h1,
.query-label {
  overflow-wrap: anywhere;
}
h2 {
  font-size: 20px;
  margin-bottom: 20px;
}
section {
  margin-top: 32px;
}
.query-label,
.state-message {
  color: var(--text-mute);
}
.state-message {
  padding: 24px 0;
}
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
  gap: 18px;
}
.media-grid > * {
  min-width: 0;
  overflow-wrap: anywhere;
}
.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
  gap: 14px;
}
.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
}
.user-card:hover {
  border-color: var(--blue);
}
.username {
  min-width: 0;
  overflow-wrap: anywhere;
}
.search-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  max-width: 100%;
  padding: 4px;
  margin: 20px -4px 0;
}
.search-tabs button,
.retry {
  flex-shrink: 0;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-dim);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.search-tabs button.active {
  background: rgba(47, 91, 255, 0.15);
  border-color: var(--blue);
  color: var(--blue);
}
.search-tabs button:focus-visible,
.retry:focus-visible,
.user-card:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.retry {
  margin-left: 8px;
  margin-top: 8px;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--navy);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
@media (max-width: 768px) {
  .search-results {
    padding: 24px;
  }
}
</style>
