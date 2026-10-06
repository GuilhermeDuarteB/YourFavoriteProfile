<script setup>
import { onMounted, ref, watch } from "vue";
import { useAuthStore } from "../../stores/authStore";
import api from "../../api/axios.js";
import TopFiveEditor from "./TopFiveEditor.vue";

const authStore = useAuthStore();

const bio = ref("");
const avatarUrl = ref("");
const profileError = ref("");
const profileSuccess = ref("");
const profileSaving = ref(false);

async function loadCurrentProfile() {
  const username = authStore.user?.username;
  if (!username) return;

  try {
    const res = await api.get(`/users/${encodeURIComponent(username)}`);
    bio.value = res.data.bio || "";
    avatarUrl.value = res.data.avatarUrl || "";
  } catch {
    profileError.value = "Error loading profile";
  }
}

async function saveProfile() {
  profileError.value = "";
  profileSuccess.value = "";
  profileSaving.value = true;
  try {
    await api.put("/users/me", { bio: bio.value, avatarUrl: avatarUrl.value });
    profileSuccess.value = "Profile updated.";
  } catch (err) {
    profileError.value = err.response?.data?.error || "Error updating profile";
  } finally {
    profileSaving.value = false;
  }
}

onMounted(loadCurrentProfile);
watch(() => authStore.user?.username, loadCurrentProfile);
</script>

<template>
  <div class="settings-section">
    <div class="section-heading">
      <div>
        <h2 id="profile-settings-heading">Profile</h2>
        <p>Manage the information shown on your public profile.</p>
      </div>
    </div>

    <section class="settings-card" aria-labelledby="profile-details-heading">
      <div class="card-heading">
        <h3 id="profile-details-heading">Public profile</h3>
        <p>These details are visible to people who visit your profile.</p>
      </div>

      <div class="field">
        <label for="profile-bio">Bio</label>
        <textarea
          id="profile-bio"
          v-model="bio"
          maxlength="280"
          rows="4"
          placeholder="Tell people about yourself..."
        ></textarea>
      </div>

      <div class="field">
        <label for="profile-avatar-url">Avatar URL</label>
        <input
          id="profile-avatar-url"
          v-model="avatarUrl"
          type="url"
          placeholder="https://example.com/your-photo.jpg"
        />
      </div>

      <p v-if="profileError" class="error" role="alert">{{ profileError }}</p>
      <p v-if="profileSuccess" class="success" role="status">{{ profileSuccess }}</p>

      <button class="btn btn-primary" type="button" :disabled="profileSaving" @click="saveProfile">
        {{ profileSaving ? "Saving..." : "Save profile" }}
      </button>
    </section>

    <TopFiveEditor :username="authStore.user?.username || ''" />
  </div>
</template>

<style scoped>
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-heading h2 {
  margin: 0 0 6px;
  font-size: 22px;
  letter-spacing: -0.2px;
}

.section-heading p,
.card-heading p {
  margin: 0;
  color: var(--text-mute);
  font-size: 13px;
  line-height: 1.5;
}

.settings-card {
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-card);
}

.card-heading {
  margin-bottom: 18px;
}

.card-heading h3 {
  margin: 0 0 5px;
  font-size: 16px;
}

.field {
  margin-bottom: 15px;
}

.field label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 600;
}

.field input,
.field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s ease;
}

.field textarea {
  resize: vertical;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--blue);
}

.field input:focus-visible,
.field textarea:focus-visible,
.btn:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}

.btn {
  padding: 9px 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary {
  border-color: var(--blue);
  background: var(--blue);
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error,
.success {
  margin: 0 0 12px;
  font-size: 12.5px;
}

.error { color: #f27272; }
.success { color: #3ecf8e; }

@media (max-width: 480px) {
  .settings-card {
    padding: 18px;
  }
}
</style>
