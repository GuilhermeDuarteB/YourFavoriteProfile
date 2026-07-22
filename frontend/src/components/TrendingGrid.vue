<script setup>
import MediaCard from './MediaCard.vue';

defineProps({
  items: Array, // [{ title, type, meta, score, posterUrl }]
});
</script>

<template>
  <section>
    <div class="section-head">
      <h2>Trending this week</h2>
      <router-link to="/trending" class="see-all">See all →</router-link>
    </div>
    <div class="grid">
      <MediaCard v-for="item in items" :key="item.title" v-bind="item" />
    </div>
  </section>
</template>

<style scoped>
section { padding: 48px 56px; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 22px; }
.section-head h2 { font-size: 22px; font-weight: 700; }
.see-all { font-size: 13px; color: var(--blue); font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px; }
</style>