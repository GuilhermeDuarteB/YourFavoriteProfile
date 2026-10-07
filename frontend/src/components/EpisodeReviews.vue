<script setup>
import { computed, ref } from "vue";
import api from "../api/axios.js";
import { useAuthStore } from "../stores/authStore";
import ReviewForm from "./ReviewForm.vue";
import ReviewList from "./ReviewList.vue";
import Modal from "./Modal.vue";

const props = defineProps({ episode: { type: Object, required: true } });
const emit = defineEmits(["changed"]);
const authStore = useAuthStore();
const reviews = ref([]);
const loaded = ref(false);
const loading = ref(false);
const error = ref("");
const expanded = ref(false);
const showForm = ref(false);
const deleting = ref(false);
const confirmingDelete = ref(false);
const deleteButton = ref(null);

function cancelDelete() {
  confirmingDelete.value = false;
  deleteButton.value?.focus();
}
const myReview = computed(
  () =>
    reviews.value.find((review) => review.user_id === authStore.user?.id) ||
    null,
);
const communityScore = computed(() => {
  const scores = reviews.value
    .map((review) => Number(review.score))
    .filter(Number.isFinite);
  return scores.length
    ? (
        scores.reduce((total, score) => total + score, 0) / scores.length
      ).toFixed(1)
    : null;
});

async function loadReviews() {
  if (loading.value) return false;
  loading.value = true;
  error.value = "";
  try {
    const res = await api.get(`/reviews/episode/${props.episode.episodeId}`);
    reviews.value = res.data;
    loaded.value = true;
    return true;
  } catch (err) {
    error.value =
      err.response?.data?.error ||
      "Unable to load episode reviews. Please retry.";
    return false;
  } finally {
    loading.value = false;
  }
}

async function toggleReviews() {
  expanded.value = !expanded.value;
  if (expanded.value && !loaded.value) await loadReviews();
}

async function openReview() {
  if (!authStore.isAuthenticated) return;
  if (!loaded.value && !(await loadReviews())) return;
  confirmingDelete.value = false;
  showForm.value = true;
}

async function onSaved() {
  showForm.value = false;
  expanded.value = true;
  await loadReviews();
  emit("changed");
}

async function deleteReview() {
  if (
    !myReview.value ||
    deleting.value ||
    loading.value ||
    !confirmingDelete.value
  )
    return;
  deleting.value = true;
  error.value = "";
  try {
    await api.delete(`/reviews/${myReview.value.id}`);
    confirmingDelete.value = false;
    await loadReviews();
    emit("changed");
  } catch (err) {
    error.value = err.response?.data?.error || "Unable to delete your review.";
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="episode-reviews">
    <p v-if="loaded" class="episode-score">
      {{ communityScore === null ? "No ratings yet" : `★ ${communityScore}` }} ·
      {{ reviews.length }} community
      {{ reviews.length === 1 ? "review" : "reviews" }}
    </p>
    <div class="episode-actions">
      <button
        v-if="authStore.isAuthenticated"
        type="button"
        class="action action-primary"
        :disabled="loading || deleting"
        @click="openReview"
      >
        <span aria-hidden="true">★</span>
        {{ myReview ? "Edit review" : "Write a review" }}
      </button>
      <router-link v-else to="/login" class="action action-primary"
        >Log in to review this episode</router-link
      >
      <button
        type="button"
        class="action action-secondary"
        :aria-expanded="expanded"
        :aria-controls="`episode-reviews-${episode.episodeId}`"
        @click="toggleReviews"
      >
        {{ expanded ? "Hide reviews" : "Reviews"
        }}{{ loaded ? ` (${reviews.length})` : "" }}
      </button>
      <button
        v-if="myReview"
        ref="deleteButton"
        type="button"
        class="action action-danger"
        :disabled="deleting || loading"
        :aria-expanded="confirmingDelete"
        :aria-controls="`delete-episode-review-${episode.episodeId}`"
        :aria-label="`Delete your review of ${episode.title}`"
        @click="confirmingDelete = !confirmingDelete"
      >
        Delete
      </button>
    </div>
    <div
      v-if="confirmingDelete"
      :id="`delete-episode-review-${episode.episodeId}`"
      class="delete-confirmation"
      role="group"
      :aria-label="`Confirm deletion of your review of ${episode.title}`"
    >
      <p>Delete your review? This cannot be undone.</p>
      <div class="episode-actions">
        <button
          type="button"
          class="action action-danger"
          :disabled="deleting || loading"
          @click="deleteReview"
        >
          {{ deleting ? "Deleting..." : "Confirm delete" }}
        </button>
        <button
          type="button"
          class="action action-secondary"
          :disabled="deleting"
          @click="cancelDelete"
        >
          Cancel
        </button>
      </div>
    </div>
    <p v-if="loading" role="status">Loading reviews...</p>
    <p v-if="error" role="alert">
      {{ error }}
      <button
        type="button"
        class="action action-secondary"
        @click="loadReviews"
      >
        Retry reviews
      </button>
    </p>
    <div v-show="expanded" :id="`episode-reviews-${episode.episodeId}`">
      <ReviewList v-if="loaded" :reviews="reviews" />
    </div>
    <Modal v-if="showForm" @close="showForm = false">
      <p class="episode-context">
        E{{ String(episode.episodeNumber).padStart(2, "0") }} ·
        {{ episode.title }}
      </p>
      <ReviewForm
        :episode-id="episode.episodeId"
        :existing-review="myReview"
        @saved="onSaved"
        @cancel="showForm = false"
      />
    </Modal>
  </div>
</template>

<style scoped>
.episode-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--border, #293041);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.action-primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}

.action-primary:hover {
  filter: brightness(1.12);
}

.action-secondary:hover {
  border-color: var(--blue);
}

.action-danger {
  color: #f27272;
  border-color: rgba(242, 114, 114, 0.4);
  background: transparent;
}

.action-danger:hover {
  background: rgba(242, 114, 114, 0.08);
  border-color: #f27272;
}

.delete-confirmation {
  padding: 12px;
  margin: 12px 0;
  border: 1px solid rgba(242, 114, 114, 0.3);
  border-radius: 8px;
}

button:disabled {
  opacity: 0.6;
  cursor: wait;
}

button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.episode-score,
.episode-context,
p {
  font-size: 12px;
  color: var(--text-dim);
}

.episode-score {
  margin: 10px 0;
}

[role="alert"] {
  color: #f27272;
}

.episode-context {
  padding-right: 24px;
}
</style>
