<script setup>
import { ref, watch } from 'vue';
import api from '../api/axios.js';

const props = defineProps({
  username: String,
  initialFollowing: Boolean,
});

const following = ref(props.initialFollowing);
const loading = ref(false);

watch(() => props.initialFollowing, (v) => (following.value = v));

async function toggle() {
  loading.value = true;
  try {
    if (following.value) {
      await api.delete(`/follow/${props.username}`);
      following.value = false;
    } else {
      await api.post(`/follow/${props.username}`);
      following.value = true;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <button class="btn" :class="{ 'btn-primary': !following }" :disabled="loading" @click="toggle">
    {{ following ? 'Following' : 'Follow' }}
  </button>
</template>