<script setup>
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";
import MediaCard from "../components/MediaCard.vue";

const route = useRoute();
const authStore = useAuthStore();

const items = ref([]);
const loading = ref(true);
const error = ref("");
const activeStatus = ref("all");
const owner = ref(null);
let requestVersion = 0;

const statuses = [
  { id: "all", label: "All" },
  { id: "want_to_watch", label: "Want to watch" },
  { id: "watching", label: "Watching" },
  { id: "completed", label: "Completed" },
  { id: "dropped", label: "Dropped" },
];

const isOwnWatchlist = computed(
  () => !!authStore.user && owner.value?.id === authStore.user.id,
);

async function loadWatchlist() {
  const version = ++requestVersion;
  loading.value = true;
  error.value = "";
  items.value = [];
  try {
    if (!authStore.user) {
      owner.value = null;
      return;
    }
    const username = route.params.username;
    if (owner.value?.username.toLowerCase() !== username.toLowerCase()) {
      owner.value = null;
      const res = await api.get(`/users/${encodeURIComponent(username)}`);
      if (version !== requestVersion) return;
      owner.value = res.data;
    }
    if (!isOwnWatchlist.value) return;
    const params =
      activeStatus.value !== "all" ? { status: activeStatus.value } : {};
    const res = await api.get("/watchlist/me", { params });
    if (version === requestVersion) items.value = res.data;
  } catch (err) {
    if (version === requestVersion) {
      error.value =
        err.response?.status === 404
          ? "User not found"
          : "Error loading watchlist";
    }
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}

async function removeItem(mediaId) {
  try {
    await api.delete(`/watchlist/${mediaId}`);
    items.value = items.value.filter((i) => i.media_id !== mediaId);
  } catch (err) {
    console.error(err);
  }
}

async function updateStatus(mediaId, status) {
  try {
    await api.post("/watchlist", { mediaId, status });
    const item = items.value.find((i) => i.media_id === mediaId);
    if (item) item.status = status;
    if (activeStatus.value !== "all") loadWatchlist();
  } catch (err) {
    console.error(err);
  }
}

watch(
  [() => route.params.username, () => authStore.user?.id, activeStatus],
  loadWatchlist,
  { immediate: true },
);
</script>

<template>
  <div>
    <NavBar />

    <div class="watchlist-page">
      <h1>{{ owner?.username || route.params.username }}'s Watchlist</h1>

      <div v-if="loading" class="state-message">Loading...</div>
      <div v-else-if="error" class="state-message">{{ error }}</div>
      <div v-else-if="!isOwnWatchlist" class="state-message">
        Watchlists are private — you can only view your own.
      </div>

      <template v-else>
        <div class="status-tabs">
          <button
            v-for="s in statuses"
            :key="s.id"
            :class="['status-tab', { active: activeStatus === s.id }]"
            @click="activeStatus = s.id"
          >
            {{ s.label }}
          </button>
        </div>

        <div v-if="items.length === 0" class="state-message">
          Nothing here yet.
        </div>
        <div v-else class="grid">
          <router-link
            v-for="item in items"
            :key="item.media_id"
            :to="`/${item.type}/${item.external_id}`"
            class="watch-card"
          >
            <div
              class="watch-poster"
              :style="
                item.poster_url
                  ? { backgroundImage: `url(${item.poster_url})` }
                  : {}
              "
            >
              <div
                class="remove-overlay"
                @click.stop.prevent="removeItem(item.media_id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M18 6 6 18M6 6l12 12"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
            <div class="watch-title">{{ item.title }}</div>
            <select
              class="status-select"
              :value="item.status"
              @click.stop.prevent
              @change="updateStatus(item.media_id, $event.target.value)"
            >
              <option value="want_to_watch">Want to watch</option>
              <option value="watching">Watching</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
          </router-link>
        </div>
      </template>
    </div>

    <Footer />
  </div>
</template>

<style scoped>
.watchlist-page {
  padding: 48px 56px;
  min-height: 60vh;
}
.watchlist-page h1 {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 24px;
}

.status-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}
.status-tab {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12.5px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 999px;
  cursor: pointer;
}
.status-tab.active {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}

.state-message {
  color: var(--text-mute);
  font-size: 14px;
  padding: 60px 0;
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 18px;
}
.watch-card {
  text-decoration: none;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.watch-poster {
  position: relative;
  aspect-ratio: 2/3;
  border-radius: 10px;
  background-color: var(--navy);
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.remove-overlay {
  position: absolute;
  inset: 0;
  background: rgba(242, 114, 114, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s ease;
  cursor: pointer;
}
.remove-overlay svg {
  width: 32px;
  height: 32px;
  color: #fff;
}
.watch-poster:hover .remove-overlay {
  opacity: 1;
}
.watch-title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-select {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 11.5px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
@media (max-width: 768px) {
  .watchlist-page {
    padding: 32px 24px;
  }
  .watchlist-page h1 {
    font-size: 22px;
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
    gap: 14px;
  }
}
</style>
