<script setup>
import { onMounted } from "vue";
import { useAuthStore } from "./stores/authStore";

const auth = useAuthStore();
onMounted(() => auth.refreshSession());
</script>

<template>
<RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  </template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
