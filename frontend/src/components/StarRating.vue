<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Number, default: 0 }, // 0-10
});
const emit = defineEmits(['update:modelValue']);

const starsValue = computed(() => props.modelValue / 2); // 0-5

function setStar(starIndex, half) {
  const value = half ? starIndex - 0.5 : starIndex;
  emit('update:modelValue', value * 2); // back to 0-10 score
}
</script>

<template>
  <div class="star-rating">
    <div v-for="i in 5" :key="i" class="star-wrap">
      <button type="button" class="star-half left" @click="setStar(i, true)"></button>
      <button type="button" class="star-half right" @click="setStar(i, false)"></button>
      <svg viewBox="0 0 24 24" class="star-bg">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
      <svg viewBox="0 0 24 24" class="star-fill" :style="{ clipPath: `inset(0 ${100 - Math.max(0, Math.min(1, starsValue - i + 1)) * 100}% 0 0)` }">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </div>
    <span class="star-value">{{ starsValue.toFixed(1) }} / 5</span>
  </div>
</template>

<style scoped>
.star-rating {
  display: flex;
  align-items: center;
  gap: 4px;
}
.star-wrap {
  position: relative;
  width: 28px;
  height: 28px;
}
.star-half {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  background: none;
  border: none;
  cursor: pointer;
  z-index: 2;
  padding: 0;
}
.star-half.left { left: 0; }
.star-half.right { right: 0; }
.star-bg, .star-fill {
  position: absolute;
  top: 0;
  left: 0;
  width: 28px;
  height: 28px;
  pointer-events: none;
}
.star-bg { fill: var(--border); }
.star-fill { fill: var(--amber); }
.star-value {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-dim);
}
</style>