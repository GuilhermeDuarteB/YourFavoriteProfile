<script setup>
defineProps({
  reviews: Array, // [{ id, username, avatar_url, score, comment, created_at, user_id }]
});

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <div class="review-list">
    <div v-if="reviews.length === 0" class="empty-state">
      No reviews yet — be the first!
    </div>
    <div v-for="r in reviews" :key="r.id" class="review-item">
      <div
        class="review-avatar"
        :style="r.avatar_url ? { backgroundImage: `url(${r.avatar_url})` } : {}"
      >
        <span v-if="!r.avatar_url">{{ r.username[0].toUpperCase() }}</span>
      </div>
      <div class="review-content">
        <div class="review-header">
          <router-link :to="`/${r.username}`" class="review-username">{{
            r.username
          }}</router-link>
          <span class="review-score">★ {{ r.score }}</span>
          <span class="review-date">{{ formatDate(r.created_at) }}</span>
        </div>
        <p v-if="r.comment" class="review-comment">{{ r.comment }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  color: var(--text-mute);
  font-size: 13px;
  padding: 20px 0;
}

.review-item {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.review-item:last-child {
  border-bottom: none;
}

.review-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--blue), var(--navy));
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.review-content {
  flex: 1;
  min-width: 0;
}

.review-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.review-username {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.review-score {
  font-size: 13px;
  font-weight: 700;
  color: var(--amber);
}

.review-date {
  font-size: 11px;
  color: var(--text-mute);
  margin-left: auto;
}

.review-comment {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.5;
  margin: 0;
}
</style>
