<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<template>
  <div>
    <h1>404</h1>
    <p>Page not found.</p>
    <button @click="router.push({ name: 'home' })">Back to Home</button>
  </div>
</template>