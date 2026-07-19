<script setup>
defineProps({
  message: {
    type: String,
    default: 'Something went wrong. Please try again later.',
  },
});
</script>

<template>
  <div>
    <h2>Ocorreu um erro</h2>
    <p>{{ message }}</p>
  </div>
</template>