<script setup>
import { ref, computed, onMounted } from "vue";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import TrendingGrid from "../components/TrendingGrid.vue";
import HeroVisual from "../components/HeroSection.vue";
import EpisodeBreakdown from "../components/EpisodeBreakdown.vue";
import Footer from "../components/Footer.vue";
import { useAuthStore } from "../stores/authStore";

const authStore = useAuthStore();

const trending = ref([]);
const latestEpisodes = ref([]);
const loading = ref(true);
const trendingError = ref("");
const episodesError = ref("");

onMounted(async () => {
  const [trendingRes, episodesRes] = await Promise.allSettled([
    api.get("/media/trending"),
    api.get("/media/latest-episodes"),
  ]);
  if (trendingRes.status === "fulfilled") trending.value = trendingRes.value.data;
  else {
    trendingError.value = "Trending media is temporarily unavailable.";
    console.error("Home trending failed:", trendingRes.reason);
  }
  if (episodesRes.status === "fulfilled") latestEpisodes.value = episodesRes.value.data;
  else {
    episodesError.value = "Latest episode data is temporarily unavailable.";
    console.error("Home latest episodes failed:", episodesRes.reason);
  }
  loading.value = false;
});

const heroPosters = computed(() =>
  trending.value.slice(0, 3).map((item) => ({
    title: item.title,
    meta: `${item.type} · ${item.meta}`,
    posterUrl: item.posterUrl,
  })),
);
</script>

<template>
  <div>
    <NavBar />
    <div class="hero">
      <div>
        <div class="eyebrow">Episode-by-episode ratings</div>
        <h1>
          Rate every episode.<br />Build your <span>series score</span>.
        </h1>
        <p>
          Movies, series, and games in one place. Episode-by-episode reviewing
          and automatic series scoring are currently in development.
        </p>
        <div class="hero-actions">
          <router-link
            v-if="!authStore.isAuthenticated"
            to="/register"
            class="btn btn-primary btn-lg"
            >Create your account</router-link
          >
          <router-link to="/browse" class="btn btn-browse btn-lg"
            >Browse trending</router-link
          >
        </div>
      </div>
      <HeroVisual
        v-if="heroPosters.length"
        :posters="heroPosters"
      />
    </div>

    <div v-if="loading" class="home-state" role="status">Loading your media feed...</div>
    <p v-else-if="trendingError && !trending.length" class="home-state" role="alert">{{ trendingError }}</p>
    <p v-else-if="!trending.length" class="home-state">No trending media is available right now.</p>
    <TrendingGrid v-else :items="trending" />

    <EpisodeBreakdown v-if="latestEpisodes.length" :episodes="latestEpisodes" />
    <p v-else-if="episodesError" class="home-note" role="status">{{ episodesError }}</p>

    <Footer />
  </div>
</template>

<style scoped>
.hero {
  padding: 64px 56px 48px;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 48px;
  align-items: center;
  border-bottom: 1px solid var(--border);
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: var(--blue);
  text-transform: uppercase;
  margin-bottom: 18px;
}
.eyebrow::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--blue);
}
.hero h1 {
  font-size: 48px;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -1px;
  margin-bottom: 18px;
  color: var(--text);
}
.hero h1 span {
  color: var(--blue);
}
.hero p {
  font-size: 16px;
  color: var(--text-dim);
  max-width: 460px;
  margin-bottom: 28px;
}
.hero-actions {
  display: flex;
  gap: 14px;
}
.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
}
.btn-lg {
  padding: 13px 26px;
  font-size: 14px;
  border-radius: 9px;
  font-weight: 700;
}
.btn-primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
.home-state,
.home-note {
  padding: 40px 56px;
  color: var(--text-mute);
  text-align: center;
}
@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 40px 24px 32px;
    gap: 28px;
  }
  .hero h1 { font-size: 36px; }
  .hero p { font-size: 14px; }
  .hero-actions { flex-wrap: wrap; }
  .home-state,
  .home-note { padding: 32px 24px; }
}
</style>
