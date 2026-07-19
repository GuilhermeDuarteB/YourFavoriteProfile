<script setup>
import { ref } from 'vue';

const query = ref('');
const results = ref([]);
</script>

<template>
  <div>
    <input v-model="query" type="text" placeholder="Search..." />
    <ul>
      <li v-for="item in results" :key="item.id">{{ item.title }}</li>
    </ul>
  </div>
</template>