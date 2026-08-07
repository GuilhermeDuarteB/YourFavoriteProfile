<script setup>
import { ref, watch } from "vue";
import api from "../api/axios.js";
import StarRating from "./StarRating.vue";

const props = defineProps({
  mediaId: [Number, String],
  existingReview: Object,
});

const emit = defineEmits(["saved", "cancel"]);

const score = ref(props.existingReview?.score || 0);
const comment = ref(props.existingReview?.comment || "");
const saving = ref(false);
const error = ref("");

watch(
  () => props.existingReview,
  (val) => {
    score.value = val?.score || 0;
    comment.value = val?.comment || "";
  },
);

async function submit() {
  error.value = "";
  if (score.value <= 0) {
    error.value = "Pick a star rating first.";
    return;
  }
  saving.value = true;
  try {
    let res;
    if (props.existingReview) {
      res = await api.put(`/reviews/${props.existingReview.id}`, {
        score: Number(score.value),
        comment: comment.value,
      });
    } else {
      res = await api.post("/reviews", {
        mediaId: props.mediaId,
        score: Number(score.value),
        comment: comment.value,
      });
    }
    emit("saved", res.data);
  } catch (err) {
    error.value = err.response?.data?.error || "Error saving review";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="review-form">
    <h3>{{ existingReview ? "Edit your review" : "Write a review" }}</h3>

    <StarRating v-model="score" />

    <textarea
      v-model="comment"
      placeholder="What did you think? (optional)"
      maxlength="1000"
    ></textarea>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="form-actions">
      <button class="btn btn-primary" :disabled="saving" @click="submit">
        {{
          saving
            ? "Saving..."
            : existingReview
              ? "Update review"
              : "Post review"
        }}
      </button>
      <button class="btn" @click="emit('cancel')">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.review-form h3 {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 16px;
}
textarea {
  width: 100%;
  min-height: 80px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  margin-top: 14px;
}
.error {
  color: #f27272;
  font-size: 12px;
  margin: 10px 0 0;
}
.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--bg);
  cursor: pointer;
}
.btn-primary {
  background: var(--blue);
  border-color: var(--blue);
  color: #fff;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
