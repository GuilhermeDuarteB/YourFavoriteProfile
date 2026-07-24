<script setup>
defineProps({
  episodes: Array, // [{ code, title, show, airDate }]
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
</script>

<template>
  <section>
    <div class="section-head">
      <h2>Latest episodes from trending series</h2>
    </div>
    <div class="episode-list">
      <div v-for="ep in episodes" :key="ep.code + ep.show" class="episode-row">
        <div class="ep-num">{{ ep.code }}</div>
        <div class="ep-info">
          <div class="ep-title">{{ ep.title }}</div>
          <div class="ep-show">{{ ep.show }}</div>
        </div>
        <div class="ep-date">{{ formatDate(ep.airDate) }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
section { padding: 48px 56px; }
.section-head { margin-bottom: 22px; }
.section-head h2 { font-size: 22px; font-weight: 700; }
.episode-list { display: flex; flex-direction: column; gap: 10px; }
.episode-row {
  display: flex; align-items: center; gap: 14px; padding: 14px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
}
.ep-num {
  width: 34px; height: 34px; border-radius: 8px; background: var(--navy);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--blue); flex-shrink: 0;
}
.ep-info { flex: 1; }
.ep-title { font-size: 13px; font-weight: 600; }
.ep-show { font-size: 11px; color: var(--text-mute); }
.ep-date { font-size: 12px; color: var(--text-dim); }
</style>