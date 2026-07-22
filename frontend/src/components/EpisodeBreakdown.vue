<script setup>
defineProps({
  episodes: Array,       // [{ code, title, show, score }]
  breakdownTitle: String,
  breakdownBars: Array,   // [{ label, score, percent }]
  average: Number,
});
</script>

<template>
  <section>
    <div class="section-head">
      <h2>Latest episode reviews</h2>
      <router-link to="/reviews" class="see-all">See all →</router-link>
    </div>
    <div class="split">
      <div>
        <div v-for="ep in episodes" :key="ep.code" class="episode-row">
          <div class="ep-num">{{ ep.code }}</div>
          <div class="ep-info">
            <div class="ep-title">{{ ep.title }}</div>
            <div class="ep-show">{{ ep.show }}</div>
          </div>
          <div class="ep-score">{{ ep.score }}</div>
        </div>
      </div>
      <div class="avg-box">
        <div class="avg-title">{{ breakdownTitle }}</div>
        <div v-for="bar in breakdownBars" :key="bar.label" class="bar-row">
          <span style="width: 24px">{{ bar.label }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: bar.percent + '%' }"></div></div>
          <span>{{ bar.score }}</span>
        </div>
        <div class="avg-total">
          <span>Season average</span>
          <span class="avg-total-num">{{ average }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
section { padding: 48px 56px; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 22px; }
.section-head h2 { font-size: 22px; font-weight: 700; }
.see-all { font-size: 13px; color: var(--blue); font-weight: 600; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.episode-row {
  display: flex; align-items: center; gap: 14px; padding: 14px;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px;
}
.ep-num {
  width: 34px; height: 34px; border-radius: 8px; background: var(--navy);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--blue); flex-shrink: 0;
}
.ep-info { flex: 1; }
.ep-title { font-size: 13px; font-weight: 600; }
.ep-show { font-size: 11px; color: var(--text-mute); }
.ep-score { font-size: 14px; font-weight: 800; color: var(--amber); }
.avg-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
.avg-title { font-size: 14px; font-weight: 700; margin-bottom: 14px; }
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; font-size: 11px; color: var(--text-mute); }
.bar-track { flex: 1; height: 6px; background: var(--navy); border-radius: 99px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--blue); border-radius: 99px; }
.avg-total {
  margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border);
  display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-dim);
}
.avg-total-num { font-size: 20px; font-weight: 800; color: var(--amber); }
</style>