<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import api from '../api/axios.js';
import NavBar from '../components/NavBar.vue';
import Footer from '../components/Footer.vue';

const route = useRoute();
const detail = ref(null);
const loading = ref(true);
const error = ref('');

// O :type vem do nome da rota (movie-detail, series-detail, game-detail)
function getTypeFromRoute() {
  if (route.name === 'movie-detail') return 'movie';
  if (route.name === 'series-detail') return 'series';
  if (route.name === 'game-detail') return 'game';
  return null;
}

async function loadDetail() {
  loading.value = true;
  error.value = '';
  try {
    const type = getTypeFromRoute();
    const res = await api.get(`/media/${type}/${route.params.id}`);
    detail.value = res.data;
  } catch (err) {
    error.value = 'Could not load this title.';
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.id, loadDetail, { immediate: true });
</script>

<template>
  <div>
    <NavBar />

    <div v-if="loading" class="state-message">Loading...</div>
    <div v-else-if="error" class="state-message">{{ error }}</div>

    <div v-else-if="detail" class="detail">
      <div class="detail-hero" :style="detail.posterUrl ? { backgroundImage: `url(${detail.posterUrl})` } : {}">
        <div class="detail-overlay">
          <div class="detail-poster" :style="detail.posterUrl ? { backgroundImage: `url(${detail.posterUrl})` } : {}"></div>
          <div class="detail-info">
            <span class="detail-type">{{ detail.type }}</span>
            <h1>{{ detail.title }}</h1>
            <div class="detail-meta">
              <span v-if="detail.releaseDate">{{ detail.releaseDate.slice(0, 4) }}</span>
              <span v-if="detail.developer">· {{ detail.developer }}</span>
              <span v-if="detail.score" class="detail-score">★ {{ detail.score }}</span>
            </div>
            <div class="detail-genres" v-if="detail.genres?.length">
              <span v-for="g in detail.genres" :key="g" class="genre-pill">{{ g }}</span>
            </div>
            <div class="detail-actions">
              <button class="btn btn-primary">Write a review</button>
              <button class="btn">Add to watchlist</button>
            </div>
          </div>
        </div>
      </div>

      <div class="detail-body">
        <section>
          <h3>Overview</h3>
          <p>{{ detail.overview || 'No description available.' }}</p>
        </section>

        <section v-if="detail.cast?.length">
          <h3>Cast</h3>
          <div class="cast-grid">
            <div v-for="c in detail.cast" :key="c.name" class="cast-card">
              <div class="cast-photo" :style="c.photoUrl ? { backgroundImage: `url(${c.photoUrl})` } : {}"></div>
              <div class="cast-name">{{ c.name }}</div>
              <div class="cast-character">{{ c.character }}</div>
            </div>
          </div>
        </section>

        <section v-if="detail.seasons?.length">
          <h3>Seasons</h3>
          <div class="season-list">
            <div v-for="s in detail.seasons" :key="s.seasonNumber" class="season-row">
              <span>{{ s.name }}</span>
              <span class="season-count">{{ s.episodeCount }} episodes</span>
            </div>
          </div>
        </section>

        <section v-if="detail.platforms?.length">
          <h3>Platforms</h3>
          <div class="detail-genres">
            <span v-for="p in detail.platforms" :key="p" class="genre-pill">{{ p }}</span>
          </div>
        </section>
      </div>
    </div>

    <Footer />
  </div>
</template>

<style scoped>
.state-message {
  text-align: center;
  color: var(--text-mute);
  padding: 80px 0;
}

.detail-hero {
  position: relative;
  background-size: cover;
  background-position: center;
  background-color: var(--navy);
}

.detail-overlay {
  background: linear-gradient(to bottom, rgba(11,13,18,0.85), rgba(11,13,18,0.97) 80%);
  padding: 56px;
  display: flex;
  gap: 32px;
  align-items: flex-end;
}

.detail-poster {
  width: 200px;
  height: 300px;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-card);
  flex-shrink: 0;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.detail-info h1 {
  font-size: 32px;
  font-weight: 800;
  margin: 6px 0 10px;
  color: var(--text);
}

.detail-type {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--blue);
}

.detail-meta {
  font-size: 14px;
  color: var(--text-dim);
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.detail-score {
  color: var(--amber);
  font-weight: 700;
}

.detail-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;
}

.genre-pill {
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--text-dim);
}

.detail-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  background: var(--bg-card);
}

.btn-primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}

.detail-body {
  padding: 40px 56px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.detail-body h3 {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
}

.detail-body p {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.6;
}

.cast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
}

.cast-photo {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-card);
  margin-bottom: 6px;
}

.cast-name {
  font-size: 12px;
  font-weight: 600;
}

.cast-character {
  font-size: 11px;
  color: var(--text-mute);
}

.season-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.season-row {
  display: flex;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13px;
}

.season-count {
  color: var(--text-mute);
}

@media (max-width: 768px) {
  .detail-overlay {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 32px 24px;
  }
  .detail-body {
    padding: 24px;
  }
}
</style>