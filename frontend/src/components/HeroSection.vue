<script setup>
defineProps({
  posters: Array, // [{ title, meta, posterUrl }]
  score: Number,
  scoreLabel: String,
});
</script>

<template>
  <div class="hero-visual">
    <div class="poster-stack">
      <div
        v-for="(poster, i) in posters"
        :key="poster.title"
        :class="['poster', `p${i + 1}`]"
        :style="
          poster.posterUrl
            ? { backgroundImage: `url(${poster.posterUrl})` }
            : {}
        "
      >
        <div class="poster-overlay">
          <div class="poster-title">{{ poster.title }}</div>
          <div class="poster-meta">{{ poster.meta }}</div>
        </div>
      </div>
      <div class="rating-chip" v-if="score">
        <div class="rating-num">{{ score }}</div>
        <div class="rating-label">{{ scoreLabel }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-visual {
  position: relative;
  height: 380px;
}
.poster-stack {
  position: relative;
  width: 100%;
  height: 100%;
}
.poster {
  position: absolute;
  width: 190px;
  height: 280px;
  border-radius: 12px;
  border: 1px solid var(--border);
  overflow: hidden;
  background-size: cover;
  background-position: center;
  background-color: var(--navy);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.poster-overlay {
  padding: 14px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent 70%);
}
.poster-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}
.poster-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 2px;
}
.p1 {
  top: 10px;
  left: 60px;
  z-index: 3;
  transform: rotate(-3deg);
}
.p2 {
  top: 60px;
  left: 230px;
  z-index: 2;
  transform: rotate(4deg);
}
.p3 {
  top: 0px;
  left: 0px;
  z-index: 1;
  transform: rotate(-9deg);
  opacity: 0.9;
}
.rating-chip {
  position: absolute;
  bottom: 130px;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 4;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
}
.rating-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--amber);
}
.rating-label {
  font-size: 11px;
  color: var(--text-dim);
}
</style>
