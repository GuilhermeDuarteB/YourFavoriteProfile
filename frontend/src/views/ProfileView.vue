<script setup>
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();

function handleLogout() {
  authStore.logout();
}
</script>

<template>
  <div v-if="authStore.user">
    <h1>{{ authStore.user.username }}</h1>
    <p>{{ authStore.user.email }}</p>
    <button @click="handleLogout">Logout</button>
  </div>
</template>