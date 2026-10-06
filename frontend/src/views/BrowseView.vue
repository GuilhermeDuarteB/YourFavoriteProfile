<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";
import MediaCard from "../components/MediaCard.vue";
import { getGenreOptions } from "../constants/mediaGenres.js";

import { useAuthStore } from "../stores/authStore";

const authStore = useAuthStore();
const route = useRoute();
const watchlistOnly = ref(authStore.isAuthenticated && route.query.watchlist === "true");
const watchlistEnabled = computed(() => authStore.isAuthenticated && watchlistOnly.value);
const router = useRouter();

const selectedTypes = ref(
  typeof route.query.types === "string"
    ? route.query.types.split(",").filter((type) => ["movie", "series", "game"].includes(type))
    : ["movie", "series", "game"],
);
const selectedGenre = ref(route.query.genre || "all");
const genreOptions = computed(() => getGenreOptions(selectedTypes.value));
const allTypesSelected = computed(() =>
  ["movie", "series", "game"].every((type) => selectedTypes.value.includes(type)),
);

function normalizeGenre() {
  if (!genreOptions.value.some((option) => option.value === selectedGenre.value)) {
    selectedGenre.value = "all";
  }
}
normalizeGenre();
watch(genreOptions, normalizeGenre, { flush: "sync" });
const selectedDecade = ref(route.query.decade || "all");
const sortBy = ref(route.query.sortBy || "popularity");
const minRating = ref(
  route.query.minRating ? Number(route.query.minRating) : 0,
);

const results = ref([]);
const error = ref("");
const warnings = ref([]);
const coverage = ref("");
const WATCHLIST_SCAN_PAGES = 5;
const PAGE_SIZE = 50;
let watchlistPromise = null;
let watchlistCache = null;
let requestId = 0;
const currentPage = ref(Math.max(1, Math.floor(Number(route.query.page)) || 1));
const loading = ref(false);
const hasMore = ref(true);

const searchQuery = ref(route.query.query || "");
let debounceTimer = null;

function toggleType(type) {
  if (allTypesSelected.value) {
    selectedTypes.value = [type];
  } else if (selectedTypes.value.includes(type)) {
    selectedTypes.value = selectedTypes.value.filter((t) => t !== type);
  } else {
    selectedTypes.value.push(type);
  }
}

function syncUrl() {
  router.replace({
    query: {
      types: selectedTypes.value.join(","),
      query: searchQuery.value || undefined,
      genre: selectedGenre.value !== "all" ? selectedGenre.value : undefined,
      decade: selectedDecade.value !== "all" ? selectedDecade.value : undefined,
      sortBy: sortBy.value !== "popularity" ? sortBy.value : undefined,
      minRating: minRating.value > 0 ? minRating.value : undefined,
      watchlist: watchlistEnabled.value ? "true" : undefined,
      page: currentPage.value > 1 ? currentPage.value : undefined,
    },
  });
}

function getWatchlist() {
  if (!watchlistPromise) {
    const pending = api.get("/watchlist/me").then((res) =>
      new Set(res.data.map((item) => item.type + ":" + String(item.external_id))),
    );
    watchlistPromise = pending;
    pending.catch(() => { if (watchlistPromise === pending) watchlistPromise = null; });
  }
  return watchlistPromise;
}

async function loadResults() {
  const id = ++requestId;
  results.value = [];
  error.value = "";
  warnings.value = [];
  coverage.value = "";
  hasMore.value = false;
  loading.value = false;
  if (selectedTypes.value.length === 0) return;
  loading.value = true;
  const params = {
    types: selectedTypes.value.join(","), query: searchQuery.value.trim(),
    genre: selectedGenre.value, decade: selectedDecade.value,
    minRating: minRating.value, sortBy: sortBy.value,
  };
  try {
    if (watchlistEnabled.value) {
      const key = JSON.stringify(params);
      if (watchlistCache?.key !== key) {
        const identities = await getWatchlist();
        if (id !== requestId) return;
        const matches = new Map();
        const messages = new Set();
        let more = identities.size > 0;
        let scanned = 0;
        while (more && scanned < WATCHLIST_SCAN_PAGES) {
          let res;
          try {
            res = await api.get("/media/discover", { params: { ...params, page: scanned + 1 } });
          } catch (err) {
            if (id !== requestId) return;
            if (!scanned) throw err;
            console.error("Watchlist Browse scan failed:", err);
            messages.add("Some Browse pages could not be loaded. Showing matches from the pages checked successfully.");
            break;
          }
          if (id !== requestId) return;
          scanned++;
          for (const item of res.data.results) {
            const identity = item.type + ":" + String(item.id);
            if (identities.has(identity)) matches.set(identity, item);
          }
          for (const warning of res.data.warnings || []) messages.add(warning);
          more = res.data.hasMore;
        }
        const items = [...matches.values()];
        if (params.sortBy === "rating") items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        if (params.sortBy === "title") items.sort((a, b) => a.title.localeCompare(b.title));
        if (params.sortBy === "release_date") items.sort((a, b) => (b.releaseDate || b.meta || "").localeCompare(a.releaseDate || a.meta || ""));
        watchlistCache = { key, items, warnings: [...messages], scanned, more };
      }
      const cached = watchlistCache;
      const maxPage = Math.max(1, Math.ceil(cached.items.length / PAGE_SIZE));
      if (currentPage.value > maxPage) { currentPage.value = maxPage; return; }
      results.value = cached.items.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE);
      hasMore.value = currentPage.value < maxPage;
      warnings.value = cached.warnings;
      coverage.value = params.query
        ? "Watchlist matches within the first page of search results from each provider; this is not a full watchlist search."
        : cached.more
          ? "Watchlist matches within the first " + cached.scanned + " Browse pages. More matches may exist beyond this limit."
          : "Watchlist matches within the available Browse results.";
    } else {
      const res = await api.get("/media/discover", { params: { ...params, page: currentPage.value } });
      if (id !== requestId) return;
      results.value = res.data.results;
      hasMore.value = res.data.hasMore;
      warnings.value = res.data.warnings || [];
    }
  } catch (err) {
    if (id !== requestId) return;
    console.error("Browse results failed:", err);
    error.value = err.response?.data?.error || "Unable to load results. Please try again.";
  } finally {
    if (id === requestId) loading.value = false;
  }
}

function goToPage(page) {
  if (page < 1) return;
  currentPage.value = page;
}

function scheduleResults(delay) {
  requestId++;
  loading.value = true;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    syncUrl();
    if (currentPage.value === 1) {
      loadResults();
    } else {
      currentPage.value = 1;
    }
  }, delay);
}

watch(
  [selectedTypes, selectedGenre, selectedDecade, sortBy, minRating, watchlistOnly],
  () => scheduleResults(200),
  { deep: true },
);

watch(currentPage, () => {
  clearTimeout(debounceTimer);
  syncUrl();
  loadResults();
});

watch(searchQuery, () => scheduleResults(400));

watch(() => authStore.token, () => {
  requestId++;
  clearTimeout(debounceTimer);
  watchlistPromise = null;
  watchlistCache = null;
  if (!authStore.isAuthenticated && watchlistOnly.value) watchlistOnly.value = false;
  else loadResults();
});

watch(() => route.query.watchlist, (value) => {
  watchlistOnly.value = authStore.isAuthenticated && value === "true";
});

watch(() => [route.query.types, route.query.genre], ([types, genre]) => {
  const nextTypes = typeof types === "string" ? types.split(",").filter(Boolean) : ["movie", "series", "game"];
  if (nextTypes.join(",") !== selectedTypes.value.join(",")) selectedTypes.value = nextTypes;
  selectedGenre.value = typeof genre === "string" ? genre : "all";
  normalizeGenre();
});

onMounted(() => {
  if ((!authStore.isAuthenticated && route.query.watchlist) || (route.query.genre && route.query.genre !== selectedGenre.value)) syncUrl();
  loadResults();
});
onBeforeUnmount(() => { requestId++; clearTimeout(debounceTimer); });
</script>

<template>
  <div>
    <NavBar />

        <div class="filter">
      <div class="search-bar">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" stroke-linecap="round" stroke-linejoin="round" />
          <path d="m20 20-3.5-3.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search movies, series, and games..."
          class="search-input"
        />
        <button v-if="searchQuery" type="button" class="clear-btn" @click="searchQuery = ''">
          ✕
        </button>
      </div>

      <section class="browse-by">

        <label class="filter-group">
          <span class="filter-label">Type</span>
          <div class="pill-row">
            <button type="button" :class="['pill', { active: allTypesSelected }]" :aria-pressed="allTypesSelected" @click="selectedTypes = ['movie', 'series', 'game']">All types</button>
            <button type="button" :class="['pill', { active: !allTypesSelected && selectedTypes.includes('movie') }]" :aria-pressed="!allTypesSelected && selectedTypes.includes('movie')" @click="toggleType('movie')">Movies</button>
            <button type="button" :class="['pill', { active: !allTypesSelected && selectedTypes.includes('series') }]" :aria-pressed="!allTypesSelected && selectedTypes.includes('series')" @click="toggleType('series')">Series</button>
            <button type="button" :class="['pill', { active: !allTypesSelected && selectedTypes.includes('game') }]" :aria-pressed="!allTypesSelected && selectedTypes.includes('game')" @click="toggleType('game')">Games</button>
          </div>
          <span class="type-hint">Choose a type, then add others.</span>
        </label>

        <label class="filter-group">
          <span class="filter-label">Genre</span>
          <select v-model="selectedGenre" class="filter-select">
            <option value="all">All genres</option>
            <option v-for="option in genreOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label class="filter-group">
          <span class="filter-label">Decade</span>
          <select v-model="selectedDecade" class="filter-select">
            <option value="all">All decades</option>
            <option value="2020">2020s</option>
            <option value="2010">2010s</option>
            <option value="2000">2000s</option>
            <option value="1990">1990s</option>
            <option value="1980">1980s</option>
            <option value="1970">1970s</option>
            <option value="1960">1960s</option>
            <option value="1950">1950s</option>
            <option value="1940">1940s</option>
            <option value="1930">1930s</option>
            <option value="1920">1920s</option>
            <option value="1910">1910s</option>
            <option value="1900">1900s</option>
          </select>
        </label>

        <label class="filter-group">
          <span class="filter-label">Minimum rating</span>
          <div class="rating-row">
            <input type="range" v-model="minRating" min="0" max="10" step="0.5" class="rating-slider" />
            <span class="rating-value">{{ minRating }}+</span>
          </div>
        </label>

        <label class="filter-group">
          <span class="filter-label">Sort by</span>
          <select v-model="sortBy" class="filter-select">
            <option value="popularity">Popularity</option>
            <option value="rating">Rating</option>
            <option value="release_date">Release date</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </label>

        <label v-if="authStore.isAuthenticated" class="filter-group">
          <span class="filter-label">Only show my watchlist</span>
          <input type="checkbox" v-model="watchlistOnly" />
        </label>
      </section>
    </div>

    <section class="results">
      <p v-if="watchlistEnabled" class="filter-note">
        Matches use your saved watchlist and up to five Browse pages, not the entire catalogue.
        <router-link :to="{ name: 'user-watchlist', params: { username: authStore.user.username } }">View your full watchlist</router-link>
      </p>
      <p v-if="coverage" class="filter-note">{{ coverage }}</p>
      <p v-for="warning in warnings" :key="warning" class="filter-note" role="status">{{ warning }}</p>
      <div v-if="loading" class="state-message">Loading...</div>
      <div v-else-if="error" class="state-message" role="alert">
        {{ error }} <button class="page-btn" @click="loadResults">Retry</button>
      </div>
      <div v-else-if="results.length === 0" class="state-message">
        {{ watchlistEnabled ? "No watchlist matches in the checked results." : "No results found." }}
      </div>
      <div v-else class="grid">
        <MediaCard
          v-for="item in results"
          :key="item.type + item.id"
          v-bind="item"
        />
      </div>

      <div class="pagination" v-if="!loading && !error && (results.length > 0 || hasMore || currentPage > 1)">
        <button
          class="page-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          ← Previous
        </button>
        <span class="page-label">Page {{ currentPage }}</span>
        <button
          class="page-btn"
          :disabled="!hasMore"
          @click="goToPage(currentPage + 1)"
        >
          Next →
        </button>
      </div>
    </section>

    <Footer />
  </div>
</template>

<style scoped>
.filter-note { color: var(--text-mute); font-size: 13px; margin-bottom: 12px; }
.filter-note a { color: var(--blue); }
.filter {
  padding: 32px 56px;
  border-bottom: 1px solid var(--border);
}

.browse-by {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px 24px;
}

.browse-by h3 {
  width: 100%;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-mute);
  margin: 0 0 4px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: default;
}

.filter-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.type-hint {
  font-size: 11px;
  color: var(--text-mute);
}

.pill {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill:hover {
  border-color: var(--blue);
  color: var(--text);
}

.pill.active {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}

.filter-select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  min-width: 150px;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--blue);
}

.rating-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rating-slider {
  width: 120px;
  accent-color: var(--blue);
}

.rating-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--amber);
  width: 32px;
}

.results {
  padding: 32px 56px 48px;
}

.state-message {
  text-align: center;
  color: var(--text-mute);
  padding: 60px 0;
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 18px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 36px;
}

.page-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--blue);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-label {
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 600;
}

@media (max-width: 768px) {
  .filter {
    padding: 24px;
  }
  .browse-by {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-select,
  .pill-row {
    width: 100%;
  }
  .results {
    padding: 24px;
  }
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.search-icon {
  position: absolute;
  left: 18px;
  width: 20px;
  height: 20px;
  color: var(--text-mute);
  pointer-events: none;
}

.search-input {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 44px;
  font-size: 15px;
  color: var(--text);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.search-input::placeholder {
  color: var(--text-mute);
}

.search-input:focus {
  outline: none;
  border-color: var(--blue);
  background: var(--bg);
}

.clear-btn {
  position: absolute;
  right: 16px;
  background: none;
  border: none;
  color: var(--text-mute);
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.clear-btn:hover {
  color: var(--text);
}

@media (max-width: 768px) {
  .search-input {
    padding: 14px 40px;
    font-size: 14px;
  }
}
</style>
