<script setup>
defineProps({
  activeSection: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["select"]);

const sections = [
  { id: "profile", label: "Profile", description: "Public profile and Top 5" },
  { id: "account", label: "Account", description: "Username and email" },
  { id: "security", label: "Security", description: "Session controls" },
  {
    id: "danger",
    label: "Danger Zone",
    description: "Permanent account actions",
  },
];
</script>

<template>
  <nav class="settings-sidebar" aria-label="Settings sections">
    <button
      v-for="section in sections"
      :key="section.id"
      type="button"
      class="settings-nav-item"
      :class="{ active: activeSection === section.id }"
      :aria-current="activeSection === section.id ? 'page' : undefined"
      @click="emit('select', section.id)"
    >
      <span class="settings-nav-label">{{ section.label }}</span>
      <span class="settings-nav-description">{{ section.description }}</span>
    </button>
  </nav>
</template>

<style scoped>
.settings-sidebar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  padding: 2px 2px 8px;
  scrollbar-width: thin;
}

.settings-nav-item {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: max-content;
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-dim);
  text-align: center;
  cursor: pointer;
  font: inherit;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.settings-nav-item:hover {
  color: var(--text);
  background: var(--bg-card);
}

.settings-nav-item.active {
  color: var(--text);
  background: var(--bg-card);
  border-color: var(--blue);
  box-shadow: inset 0 -2px 0 var(--blue);
}

.settings-nav-label {
  font-size: 13px;
  font-weight: 700;
}

.settings-nav-description {
  display: none;
}

.settings-nav-item:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

@media (max-width: 760px) {
  .settings-nav-item {
    padding: 10px 12px;
  }
}
</style>
