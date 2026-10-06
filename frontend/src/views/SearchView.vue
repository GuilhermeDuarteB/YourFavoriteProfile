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
const loading = ref(false);
const mediaError = ref("");
const usersError = ref("");
const mediaWarnings = ref([]);

watch(query, async (q, previousQuery, onCleanup) => {
  let active = true;
  onCleanup(() => { active = false; });
  media.value = [];
  users.value = [];
  mediaError.value = "";
  usersError.value = "";
  mediaWarnings.value = [];
  loading.value = !!q;
  if (!q) return;

  const [mediaResponse, usersResponse] = await Promise.allSettled([
    api.get("/media/discover", { params: { query: q } }),
    api.get("/users/search", { params: { q } }),
  ]);
  if (!active) return;

  if (mediaResponse.status === "fulfilled") {
    media.value = mediaResponse.value.data.results;
    mediaWarnings.value = mediaResponse.value.data.warnings || [];
  } else {
    mediaError.value = "Unable to load media results. Please try again.";
  }
  if (usersResponse.status === "fulfilled") {
    users.value = usersResponse.value.data;
  } else {
    usersError.value = "Unable to load user results. Please try again.";
  }
  loading.value = false;
}, { immediate: true });
</script>

<template>
  <div>
    <NavBar />
    <main class="search-results">
      <h1>Search</h1>
      <p v-if="!query" class="state-message">Search for titles or users using the search bar above.</p>
      <template v-else>
        <p class="query-label">Results for “{{ query }}”</p>
        <p v-if="loading" class="state-message" role="status">Loading results...</p>
        <template v-else>
          <section>
            <h2>Movies, series, and games</h2>
            <p v-for="warning in mediaWarnings" :key="warning" class="query-label" role="status">{{ warning }}</p>
            <p v-if="mediaError" class="state-message" role="alert">{{ mediaError }}</p>
            <p v-else-if="!media.length" class="state-message">No media found.</p>
            <div v-else class="media-grid">
              <MediaCard v-for="item in media" :key="`${item.type}-${item.id}`" v-bind="item" />
            </div>
          </section>
          <section>
            <h2>Users</h2>
            <p v-if="usersError" class="state-message" role="alert">{{ usersError }}</p>
            <p v-else-if="!users.length" class="state-message">No users found.</p>
            <div v-else class="users-grid">
              <router-link
                v-for="user in users"
                :key="user.id"
                :to="{ name: 'profile', params: { username: user.username } }"
                class="user-card"
              >
                <img v-if="user.avatar_url" :src="user.avatar_url" alt="" class="avatar" />
                <span v-else class="avatar">{{ user.username[0].toUpperCase() }}</span>
                <span>{{ user.username }}</span>
              </router-link>
            </div>
          </section>
        </template>
      </template>
    </main>
    <Footer />
  </div>
</template>

<style scoped>
.search-results { padding: 32px 56px 48px; }
h1 { margin-bottom: 12px; }
h2 { font-size: 20px; margin-bottom: 20px; }
section { margin-top: 32px; }
.query-label, .state-message { color: var(--text-mute); }
.state-message { padding: 24px 0; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 18px; }
.users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.user-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; color: var(--text); }
.user-card:hover { border-color: var(--blue); }
.avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: var(--navy); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
@media (max-width: 768px) {
  .search-results { padding: 24px; }
}
</style>
