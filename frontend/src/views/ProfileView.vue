<script setup>
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import api from '../api/axios';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const profile = ref(null);
const loading = ref(true);
const error = ref('');

const isOwnProfile = computed(() => authStore.user?.username === route.params.username);

async function loadProfile() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get(`/users/${route.params.username}`);
    profile.value = res.data;
  } catch (err) {
    error.value = err.response?.status === 404
      ? 'User not found'
      : 'Error loading profile';
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.username, loadProfile, { immediate: true });

function handleLogout() {
  router.push('/');
  authStore.logout();
}
</script>

<template>
  <div v-if="loading"></div>
  <div v-else-if="error">{{ error }}</div>
  <div v-else-if="profile">
    <h1>{{ profile.username }}</h1>
    <p v-if="profile.bio">{{ profile.bio }}</p>
    <button v-if="isOwnProfile" @click="handleLogout">Logout</button>
  </div>
</template>