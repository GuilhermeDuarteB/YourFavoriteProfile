<script setup>
import { computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";
import SettingsSidebar from "../components/settings/SettingsSidebar.vue";
import ProfileSettings from "../components/settings/ProfileSettings.vue";
import AccountSettings from "../components/settings/AccountSettings.vue";
import SecuritySettings from "../components/settings/SecuritySettings.vue";
import DangerZone from "../components/settings/DangerZone.vue";

const route = useRoute();
const router = useRouter();

const sections = ["profile", "account", "security", "danger"];

function normalizeSection(value) {
  return typeof value === "string" && sections.includes(value)
    ? value
    : "profile";
}

const activeSection = computed(() => normalizeSection(route.query.section));

function selectSection(section) {
  const nextSection = normalizeSection(section);
  router.push({
    name: "settings",
    query: { section: nextSection },
    hash:
      nextSection === "profile" && route.hash === "#top-five"
        ? "#top-five"
        : "",
  });
}

watch(
  () => route.query.section,
  (value) => {
    if (value !== undefined && normalizeSection(value) !== value) {
      router.replace({
        name: "settings",
        query: { ...route.query, section: "profile" },
        hash: route.hash,
      });
    }
  },
  { immediate: true },
);

watch(
  [activeSection, () => route.hash],
  async ([section, hash]) => {
    if (
      section !== "profile" ||
      hash !== "#top-five" ||
      typeof document === "undefined"
    )
      return;
    await nextTick();
    document
      .getElementById("top-five")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  { immediate: true },
);
</script>

<template>
  <div class="settings-page-wrap">
    <NavBar />

    <main class="settings-page">
      <header class="settings-header">
        <p class="eyebrow">Account</p>
        <h1>Settings</h1>
        <p>Manage your profile, account access, and session preferences.</p>
      </header>

      <div class="settings-layout">
        <SettingsSidebar
          :active-section="activeSection"
          @select="selectSection"
        />

        <section
          class="settings-content"
          :aria-labelledby="`${activeSection}-settings-heading`"
        >
          <ProfileSettings v-if="activeSection === 'profile'" />
          <AccountSettings v-else-if="activeSection === 'account'" />
          <SecuritySettings v-else-if="activeSection === 'security'" />
          <DangerZone v-else />
        </section>
      </div>
    </main>

    <Footer />
  </div>
</template>

<style scoped>
.settings-page-wrap {
  min-height: 100vh;
}

.settings-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 46px 40px 64px;
}

.settings-header {
  margin-bottom: 30px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--blue);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
}

.settings-header h1 {
  margin: 0 0 8px;
  color: var(--text);
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.settings-header > p:last-child {
  margin: 0;
  color: var(--text-mute);
  font-size: 13px;
  line-height: 1.5;
}

.settings-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-content {
  width: 100%;
  min-width: 0;
}

@media (max-width: 760px) {
  .settings-page {
    padding: 32px 24px 48px;
  }

  .settings-header {
    margin-bottom: 22px;
  }

  .settings-sidebar {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .settings-page {
    padding-inline: 16px;
  }

  .settings-header h1 {
    font-size: 26px;
  }
}
</style>
