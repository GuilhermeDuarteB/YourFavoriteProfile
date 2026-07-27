<script setup>
import { ref, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";
import MediaCard from "../components/MediaCard.vue";
import { useAuthStore } from "../stores/authStore";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const selectedTypes = ref(
  route.query.types
    ? route.query.types.split(",")
    : ["movie", "series", "game"],
);
const selectedGenre = ref(route.query.genre || "all");
const selectedDecade = ref(route.query.decade || "all");
const sortBy = ref(route.query.sortBy || "popularity");
const minRating = ref(
  route.query.minRating ? Number(route.query.minRating) : 0,
);
const watchlistOnly = ref(route.query.watchlist === "true");

const results = ref([]);
const currentPage = ref(route.query.page ? Number(route.query.page) : 1);
const loading = ref(false);
const hasMore = ref(true);

const searchQuery = ref(route.query.query || "");
let debounceTimer = null;

function toggleType(type) {
  if (selectedTypes.value.includes(type)) {
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
      watchlist: watchlistOnly.value ? "true" : undefined,
      page: currentPage.value > 1 ? currentPage.value : undefined,
    },
  });
}

async function loadResults() {
  if (selectedTypes.value.length === 0) {
    results.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await api.get("/media/discover", {
      params: {
        types: selectedTypes.value.join(","),
        query: searchQuery.value,
        genre: selectedGenre.value,
        decade: selectedDecade.value,
        minRating: minRating.value,
        sortBy: sortBy.value,
        page: currentPage.value,
      },
    });
    results.value = res.data.results;
    hasMore.value = res.data.hasMore;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function goToPage(page) {
  if (page < 1) return;
  currentPage.value = page;
}

watch(
  [selectedTypes, selectedGenre, selectedDecade, sortBy, minRating],
  () => {
    syncUrl();
    if (currentPage.value === 1) {
      loadResults();
    } else {
      currentPage.value = 1;
    }
  },
  { deep: true },
);

watch(currentPage, () => {
  syncUrl();
  loadResults();
});

watch(searchQuery, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    syncUrl();
    if (currentPage.value === 1) {
      loadResults();
    } else {
      currentPage.value = 1;
    }
  }, 400);
});

onMounted(loadResults);
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
            <button type="button" :class="['pill', { active: selectedTypes.includes('movie') }]" @click="toggleType('movie')">Movies</button>
            <button type="button" :class="['pill', { active: selectedTypes.includes('series') }]" @click="toggleType('series')">Series</button>
            <button type="button" :class="['pill', { active: selectedTypes.includes('game') }]" @click="toggleType('game')">Games</button>
          </div>
        </label>

        <label class="filter-group">
          <span class="filter-label">Genre</span>
          <select v-model="selectedGenre" class="filter-select">
            <option value="all">All genres</option>
            <option value="action">Action</option>
            <option value="drama">Drama</option>
            <option value="comedy">Comedy</option>
            <option value="scifi">Sci-Fi</option>
            <option value="horror">Horror</option>
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

        <label v-if="authStore.isAuthenticated" class="filter-group filter-toggle">
          <span class="filter-label">Only show my watchlist</span>
          <input type="checkbox" v-model="watchlistOnly" class="toggle-checkbox" />
        </label>
      </section>
    </div>

    <section class="results">
      <div v-if="loading" class="state-message">Loading...</div>
      <div v-else-if="results.length === 0" class="state-message">
        No results found.
      </div>
      <div v-else class="grid">
        <MediaCard
          v-for="item in results"
          :key="item.title + item.type"
          v-bind="item"
        />
      </div>

      <div class="pagination" v-if="results.length > 0">
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
  gap: 6px;
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

.filter-toggle {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.toggle-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--blue);
  cursor: pointer;
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
