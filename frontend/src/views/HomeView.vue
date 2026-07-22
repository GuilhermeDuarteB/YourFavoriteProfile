<script setup>
import {ref, onMounted, computed} from 'vue';
import api from '../api/axios.js'
import NavBar from '../components/NavBar.vue';
import TrendingGrid from '../components/TrendingGrid.vue';
import HeroVisual from '../components/HeroSection.vue';
import EpisodeBreakdown from '../components/EpisodeBreakdown.vue';
import MediaCard from '../components/MediaCard.vue';

const trending = ref([]);

onMounted(async () => {
  const res = await api.get('/media/trending');
  trending.value = res.data;
})

const heroPosters = computed(() =>
  trending.value.slice(0, 3).map((item) => ({
    title: item.title,
    meta: `${item.type} · ${item.meta}`,
    posterUrl: item.posterUrl,
  }))
);
</script>

<template>
  <div>
    <NavBar />

    <div class="hero">
      <div>
        <div class="eyebrow">Episode-by-episode ratings</div>
        <h1>Rate every episode.<br />Get the <span>real</span> series score.</h1>
        <p>Movies, series, and games in one place. For series, your season rating is built automatically from every episode you review.</p>
        <div class="hero-actions">
          <router-link to="/register" class="btn btn-primary btn-lg">Create your account</router-link>
          <router-link to="/trending" class="btn btn-lg">Browse trending</router-link>
        </div>
      </div>
        <HeroVisual
        v-if="heroPosters.length"
        :posters="heroPosters"
        :score="8.7"
        score-label="avg. from 12 episodes"
      />
    </div>

    <TrendingGrid :items="trending" />

  <EpisodeBreakdown
  :episodes="[
    { code: 'S2E7', title: 'Static Bloom', show: 'The Last Signal', score: 9.1 },
    { code: 'S1E4', title: 'Loose Ends', show: 'Paperweight', score: 7.8 },
    { code: 'S2E6', title: 'The Long Wire', show: 'The Last Signal', score: 8.4 },
    { code: 'S1E3', title: 'Quiet Hours', show: 'Paperweight', score: 8.9 },
  ]"
  breakdown-title="The Last Signal — season 2 breakdown"
  :breakdown-bars="[
    { label: 'E5', score: 7.4, percent: 74 },
    { label: 'E6', score: 8.4, percent: 84 },
    { label: 'E7', score: 9.1, percent: 91 },
    { label: 'E8', score: 8.8, percent: 88 },
  ]"
  :average="8.4"
/>
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
  display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700;
  letter-spacing: 1.2px; color: var(--blue); text-transform: uppercase; margin-bottom: 18px;
}
.eyebrow::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--blue); }
.hero h1 { font-size: 48px; font-weight: 800; line-height: 1.08; letter-spacing: -1px; margin-bottom: 18px; color: var(--text); }
.hero h1 span { color: var(--blue); }
.hero p { font-size: 16px; color: var(--text-dim); max-width: 460px; margin-bottom: 28px; }
.hero-actions { display: flex; gap: 14px; }
.btn {
  padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
  border: 1px solid var(--border); color: var(--text);
}
.btn-lg { padding: 13px 26px; font-size: 14px; border-radius: 9px; font-weight: 700; }
.btn-primary { background: var(--blue); border-color: var(--blue); color: #fff; }
</style>