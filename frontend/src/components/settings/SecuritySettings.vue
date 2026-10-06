<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/authStore";

const authStore = useAuthStore();
const router = useRouter();

function handleLogout() {
  authStore.logout();
  router.push("/");
}
</script>

<template>
  <div class="settings-section">
    <div class="section-heading">
      <h2 id="security-settings-heading">Security</h2>
      <p>Manage your current session and account access.</p>
    </div>

    <section class="settings-card" aria-labelledby="session-heading">
      <div class="card-heading">
        <h3 id="session-heading">Session</h3>
        <p>Log out of this browser when you are finished.</p>
      </div>
      <button class="btn" type="button" @click="handleLogout">Log out</button>
    </section>

    <section class="settings-card future-card" aria-labelledby="security-roadmap-heading">
      <div class="card-heading">
        <h3 id="security-roadmap-heading">More security controls</h3>
        <p>Password changes, active sessions, and two-factor authentication will be added here when supported.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-section { display: flex; flex-direction: column; gap: 18px; }
.section-heading h2 { margin: 0 0 6px; font-size: 22px; }
.section-heading p, .card-heading p { margin: 0; color: var(--text-mute); font-size: 13px; line-height: 1.5; }
.settings-card { padding: 22px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card); }
.card-heading { margin-bottom: 18px; }
.card-heading h3 { margin: 0 0 5px; font-size: 16px; }
.future-card { border-style: dashed; }
.btn { padding: 9px 18px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn:hover { border-color: var(--blue); }
.btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
</style>
