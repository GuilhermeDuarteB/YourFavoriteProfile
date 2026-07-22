<script setup>
defineProps({
  title: String,
  type: String,        // 'movie' | 'series' | 'game'
  meta: String,         // ex: "2024" ou "S2 · 8 ep"
  score: Number,
  posterUrl: String,
});
</script>

<template>
  <router-link :to="`/${type}/${title}`" class="card">
    <div class="card-poster" :style="posterUrl ? { backgroundImage: `url(${posterUrl})` } : {}">
      <span class="badge">{{ type }}</span>
    </div>
    <div class="card-body">
      <div class="card-title">{{ title }}</div>
      <div class="card-meta">
        <span>{{ meta }}</span>
        <span class="card-score" v-if="score">★ {{ score }}</span>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.card {
  display: block; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden; color: var(--text);
}
.card-poster {
  height: 160px; background-size: cover; background-position: center;
  background-color: var(--navy); position: relative;
}
.badge {
  position: absolute; top: 8px; left: 8px; background: rgba(11,13,18,0.75);
  font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 5px;
  color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px;
}
.card-body { padding: 12px 14px 14px; }
.card-title { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.card-meta {
  font-size: 11px; color: var(--text-mute); display: flex;
  justify-content: space-between; align-items: center;
}
.card-score { color: var(--amber); font-weight: 700; }
</style>