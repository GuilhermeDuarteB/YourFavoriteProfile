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
      <router-link
        v-if="authStore.isAuthenticated"
        to="/settings"
        class="settings-link"
        aria-label="Settings"
        title="Settings"
      >⚙</router-link>
    </div>
    <div class="nav-right">
      <form class="search-form" role="search" aria-label="Global site search" @submit.prevent="search">
        <input
          v-model="searchQuery"
          aria-label="Search media or users"
          class="search-pill"
          type="search"
          placeholder="Search media or users..."
        />
        <button type="submit" class="search-submit" aria-label="Search" title="Search media or users">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </button>
      </form>
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
  min-width: 0;
}

.search-form {
  display: flex;
  align-items: center;
  flex: 0 1 250px;
  min-width: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px;
}
.search-form:focus-within { outline: 2px solid var(--blue); outline-offset: 2px; }
.search-pill {
  flex: 1;
  width: 100%;
  min-width: 0;
  background: transparent;
  border: 0;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 13px;
  color: var(--text);
  outline: none;
}
.search-submit { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; border: 0; border-radius: 50%; background: var(--blue); color: #fff; cursor: pointer; }
.search-submit svg { width: 17px; height: 17px; }
.search-submit:hover { filter: brightness(1.15); }
.search-submit:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }

.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.btn-primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
@media (max-width: 1100px) {
  nav { flex-wrap: wrap; gap: 14px; padding: 16px 24px; }
  .nav-links { order: 3; width: 100%; gap: 20px; overflow-x: auto; padding-bottom: 2px; white-space: nowrap; }
  .nav-right { flex: 1; justify-content: flex-end; gap: 10px; min-width: 0; }
  .search-form { flex: 1 1 220px; }
}
@media (max-width: 620px) {
  nav { padding: 14px 16px; }
  .brand { font-size: 16px; }
  .nav-right { flex: 0 0 100%; width: 100%; order: 2; justify-content: stretch; flex-wrap: wrap; }
  .search-form { flex: 1 1 170px; }
  .nav-links { order: 3; gap: 16px; font-size: 13px; }
  .btn { padding: 8px 12px; max-width: 130px; }
}
</style>
