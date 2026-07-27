<script setup>
import { ref } from "vue";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";
import { useAuthStore } from "../stores/authStore";

const authStore = useAuthStore();
const selectedTypes = ref(["movie", "series", "game"]);
const selectedGenre = ref("all");
const selectedDecade = ref("all");
const sortBy = ref("popularity");
const minRating = ref(0);
const watchlistOnly = ref(false);

function toggleType(type) {
  if (selectedTypes.value.includes(type)) {
    selectedTypes.value = selectedTypes.value.filter((t) => t !== type);
  } else {
    selectedTypes.value.push(type);
  }
}
</script>

<template>
  <div>
    <NavBar />

    <div class="filter">
      <section class="browse-by">
        <h3>Browse By</h3>

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
            <input
              type="range"
              v-model="minRating"
              min="0"
              max="10"
              step="0.5"
              class="rating-slider"
            />
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

        <template v-if="authStore.isAuthenticated">
          <label class="filter-group filter-toggle">
            <span class="filter-label">Only show my watchlist</span>
            <input
              type="checkbox"
              v-model="watchlistOnly"
              class="toggle-checkbox"
            />
          </label>
        </template>
        <template v-else> </template>
      </section>
    </div>
    
    

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
}
</style>
