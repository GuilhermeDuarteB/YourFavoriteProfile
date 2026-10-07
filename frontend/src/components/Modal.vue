<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
const emit = defineEmits(["close"]);
const box = ref(null);
let previousFocus;
const focusable = () => [
  ...(box.value?.querySelectorAll(
    'button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]',
  ) || []),
];
function onKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
  if (event.key !== "Tab") return;
  const controls = focusable();
  const first = controls[0];
  const last = controls.at(-1);
  if (!first) {
    event.preventDefault();
    box.value?.focus();
    return;
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === box.value)
  ) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
onMounted(() => {
  previousFocus = document.activeElement;
  box.value?.focus();
});
onBeforeUnmount(() => previousFocus?.focus());
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div class="modal-overlay" @click.self="$emit('close')">
        <div
          ref="box"
          class="modal-box"
          role="dialog"
          aria-modal="true"
          aria-label="Review editor"
          tabindex="-1"
          @keydown="onKeydown"
        >
          <button
            class="modal-close"
            aria-label="Close review editor"
            @click="$emit('close')"
          >
            ✕
          </button>
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
  max-height: calc(100dvh - 40px);
  overflow-y: auto;
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
.modal-close:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
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
