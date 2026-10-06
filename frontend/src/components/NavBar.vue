<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const searchQuery = ref("");

watch(() => route.query.q, (q) => {
  searchQuery.value = typeof q === "string" ? q : "";
}, { immediate: true });

function search() {
  const q = searchQuery.value.trim();
  if (q) router.push({ name: "search", query: { q } });
}
</script>

<template>
  <nav>
    <router-link to="/" class="brand">
      <div class="brand-mark">
        <img src="../assets/ifp-logo.png" alt="Your Favorite Profile logo" />
      </div>
      Your Favorite Profile
    </router-link>

    <div class="nav-links">
      <router-link to="/browse">Browse</router-link>
      <router-link to="/movies">Movies</router-link>
      <router-link to="/series">Series</router-link>
      <router-link to="/games">Games</router-link>
      <router-link
        v-if="authStore.isAuthenticated"
        :to="`/${authStore.user.username}/watchlist`"
      >
        Watchlist
      </router-link>
      <label v-if="authStore.isAuthenticated">
        <router-link to="/settings" class="settings-link">⚙</router-link>
      </label>
    </div>
    <div class="nav-right">
      <input
        v-model="searchQuery"
        @keydown.enter.prevent="search"
        aria-label="Search titles and users"
        class="search-pill"
        type="text"
        placeholder="Search titles, users..."
      />
      <template v-if="authStore.isAuthenticated">
        <router-link
          class="btn btn-primary"
          :to="{
            name: 'profile',
            params: { username: authStore.user.username },
          }"
        >
          {{ authStore.user.username }}
        </router-link>
      </template>
      <template v-else>
        <router-link class="btn" to="/login">Log in</router-link>
        <router-link class="btn btn-primary" to="/register"
          >Sign up</router-link
        >
      </template>
    </div>
  </nav>
</template>

<style scoped>
nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 5px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: rgba(11, 13, 18, 0.9);
  backdrop-filter: blur(8px);
  z-index: 10;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 18px;
  color: var(--text);
}
.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.nav-links {
  display: flex;
  gap: 32px;
  font-size: 14px;
}

.nav-links a {
  color: var(--text-dim);
}

.nav-links a:hover {
  color: var(--text);
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.search-pill {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 9px 16px;
  font-size: 13px;
  color: var(--text);
  width: 220px;
}

.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
}

.btn-primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
@media (max-width: 1100px) {
  nav { flex-wrap: wrap; gap: 14px; padding: 16px 24px; }
  .nav-links { order: 3; width: 100%; gap: 20px; overflow-x: auto; padding-bottom: 2px; }
  .nav-right { flex: 1; justify-content: flex-end; gap: 10px; min-width: 0; }
  .search-pill { width: min(220px, 35vw); }
}
@media (max-width: 620px) {
  nav { padding: 14px 16px; }
  .brand { font-size: 16px; }
  .nav-right { width: 100%; order: 2; justify-content: stretch; }
  .search-pill { width: auto; flex: 1; min-width: 0; }
  .nav-links { order: 3; gap: 16px; font-size: 13px; }
  .btn { padding: 8px 12px; }
}
</style>
