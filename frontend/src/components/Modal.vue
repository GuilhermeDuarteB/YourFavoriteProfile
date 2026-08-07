<script setup>
defineEmits(["close"]);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-box">
          <button class="modal-close" @click="$emit('close')">✕</button>
          <slot></slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(11, 13, 18, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 24px;
  width: 100%;
  max-width: 440px;
  position: relative;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
.modal-close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: none;
  border: none;
  color: var(--text-mute);
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
}
.modal-close:hover {
  color: var(--text);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-box,
.modal-leave-active .modal-box {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.modal-enter-from .modal-box,
.modal-leave-to .modal-box {
  transform: scale(0.95) translateY(8px);
  opacity: 0;
}
</style>
