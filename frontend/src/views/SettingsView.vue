<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import api from '../api/axios.js';
import NavBar from '../components/NavBar.vue';
import Footer from '../components/Footer.vue';

const authStore = useAuthStore();
const router = useRouter();

// Profile (bio + avatar)
const bio = ref('');
const avatarUrl = ref('');
const profileError = ref('');
const profileSuccess = ref('');
const profileSaving = ref(false);
const profileLoaded = ref(false);

// Username
const newUsername = ref('');
const usernamePassword = ref('');
const usernameError = ref('');
const usernameSuccess = ref('');
const usernameSaving = ref(false);

// Email
const newEmail = ref('');
const emailPassword = ref('');
const emailError = ref('');
const emailSuccess = ref('');
const emailSaving = ref(false);

// Delete
const deletePassword = ref('');
const deleteError = ref('');
const deleteConfirmOpen = ref(false);
const deleteSaving = ref(false);

async function loadCurrentProfile() {
  try {
    const res = await api.get(`/users/${authStore.user.username}`);
    bio.value = res.data.bio || '';
    avatarUrl.value = res.data.avatarUrl || '';
  } finally {
    profileLoaded.value = true;
  }
}
loadCurrentProfile();

async function saveProfile() {
  profileError.value = '';
  profileSuccess.value = '';
  profileSaving.value = true;
  try {
    await api.put('/users/me', { bio: bio.value, avatarUrl: avatarUrl.value });
    profileSuccess.value = 'Profile updated.';
  } catch (err) {
    profileError.value = err.response?.data?.error || 'Error updating profile';
  } finally {
    profileSaving.value = false;
  }
}

async function changeUsername() {
  usernameError.value = '';
  usernameSuccess.value = '';
  usernameSaving.value = true;
  try {
    const res = await api.put('/auth/me/username', {
      newUsername: newUsername.value,
      password: usernamePassword.value,
    });
    authStore.user.username = res.data.username;
    localStorage.setItem('user', JSON.stringify(authStore.user));
    usernameSuccess.value = 'Username updated.';
    usernamePassword.value = '';
    router.replace({ name: 'settings' }); // evita URL antiga ficar "presa"
  } catch (err) {
    usernameError.value = err.response?.data?.error || 'Error updating username';
  } finally {
    usernameSaving.value = false;
  }
}

async function changeEmail() {
  emailError.value = '';
  emailSuccess.value = '';
  emailSaving.value = true;
  try {
    const res = await api.put('/auth/me/email', {
      newEmail: newEmail.value,
      password: emailPassword.value,
    });
    authStore.user.email = res.data.email;
    localStorage.setItem('user', JSON.stringify(authStore.user));
    emailSuccess.value = 'Email updated.';
    newEmail.value = '';
    emailPassword.value = '';
  } catch (err) {
    emailError.value = err.response?.data?.error || 'Error updating email';
  } finally {
    emailSaving.value = false;
  }
}

async function deleteAccount() {
  deleteError.value = '';
  deleteSaving.value = true;
  try {
    await api.delete('/auth/me', { data: { password: deletePassword.value } });
    authStore.logout();
    router.push('/');
  } catch (err) {
    deleteError.value = err.response?.data?.error || 'Error deleting account';
  } finally {
    deleteSaving.value = false;
  }
}

function handleLogout() {
  authStore.logout();
  router.push('/');
}
</script>

<template>
  <div>
    <NavBar />
    <div class="settings">
      <h1>Settings</h1>

      <!-- Profile -->
      <section class="settings-card" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Profile</h2>
        <p class="card-desc">This is what other people see on your public profile.</p>

        <div class="field">
          <label for="bio">Bio</label>
          <textarea id="bio" v-model="bio" maxlength="280" rows="3" placeholder="Tell people about yourself..."></textarea>
        </div>

        <div class="field">
          <label for="avatarUrl">Avatar URL</label>
          <input id="avatarUrl" v-model="avatarUrl" type="url" placeholder="https://example.com/your-photo.jpg" />
        </div>

        <p v-if="profileError" class="error" role="alert">{{ profileError }}</p>
        <p v-if="profileSuccess" class="success" role="status">{{ profileSuccess }}</p>

        <button class="btn btn-primary" type="button" :disabled="profileSaving" @click="saveProfile">
          {{ profileSaving ? 'Saving...' : 'Save profile' }}
        </button>
      </section>

      <!-- Username -->
      <section class="settings-card" aria-labelledby="username-heading">
        <h2 id="username-heading">Username</h2>
        <p class="card-desc">Current: <strong>@{{ authStore.user?.username }}</strong></p>

        <div class="field">
          <label for="newUsername">New username</label>
          <input id="newUsername" v-model="newUsername" type="text" autocomplete="off" />
        </div>
        <div class="field">
          <label for="usernamePassword">Confirm your password</label>
          <input id="usernamePassword" v-model="usernamePassword" type="password" autocomplete="current-password" />
        </div>

        <p v-if="usernameError" class="error" role="alert">{{ usernameError }}</p>
        <p v-if="usernameSuccess" class="success" role="status">{{ usernameSuccess }}</p>

        <button class="btn btn-primary" type="button" :disabled="usernameSaving" @click="changeUsername">
          {{ usernameSaving ? 'Saving...' : 'Update username' }}
        </button>
      </section>

      <!-- Email -->
      <section class="settings-card" aria-labelledby="email-heading">
        <h2 id="email-heading">Email</h2>
        <p class="card-desc">Current: {{ authStore.user?.email }}</p>

        <div class="field">
          <label for="newEmail">New email</label>
          <input id="newEmail" v-model="newEmail" type="email" autocomplete="off" />
        </div>
        <div class="field">
          <label for="emailPassword">Confirm your password</label>
          <input id="emailPassword" v-model="emailPassword" type="password" autocomplete="current-password" />
        </div>

        <p v-if="emailError" class="error" role="alert">{{ emailError }}</p>
        <p v-if="emailSuccess" class="success" role="status">{{ emailSuccess }}</p>

        <button class="btn btn-primary" type="button" :disabled="emailSaving" @click="changeEmail">
          {{ emailSaving ? 'Saving...' : 'Update email' }}
        </button>
      </section>

      <!-- Session -->
      <section class="settings-card" aria-labelledby="session-heading">
        <h2 id="session-heading">Session</h2>
        <button class="btn" type="button" @click="handleLogout">Log out</button>
      </section>

      <!-- Danger zone -->
      <section class="settings-card danger" aria-labelledby="danger-heading">
        <h2 id="danger-heading">Delete account</h2>
        <p class="card-desc">This permanently deletes your account, reviews, watchlist, and top 5. This cannot be undone.</p>

        <button v-if="!deleteConfirmOpen" class="btn btn-danger" type="button" @click="deleteConfirmOpen = true">
          Delete my account
        </button>

        <div v-else class="danger-confirm">
          <div class="field">
            <label for="deletePassword">Confirm your password</label>
            <input id="deletePassword" v-model="deletePassword" type="password" autocomplete="current-password" />
          </div>
          <p v-if="deleteError" class="error" role="alert">{{ deleteError }}</p>
          <div class="danger-actions">
            <button class="btn btn-danger" type="button" :disabled="deleteSaving" @click="deleteAccount">
              {{ deleteSaving ? 'Deleting...' : 'Yes, delete permanently' }}
            </button>
            <button class="btn" type="button" @click="deleteConfirmOpen = false">Cancel</button>
          </div>
        </div>
      </section>
    </div>
    <Footer />
  </div>
</template>

<style scoped>
.settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}
.settings h1 {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 28px;
}

.settings-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 22px;
  margin-bottom: 20px;
}
.settings-card h2 {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 6px;
}
.card-desc {
  font-size: 12.5px;
  color: var(--text-mute);
  margin: 0 0 16px;
}

.field {
  margin-bottom: 14px;
}
.field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  margin-bottom: 6px;
}
.field input,
.field textarea {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.field textarea { resize: vertical; }
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

.error { color: #f27272; font-size: 12.5px; margin: 0 0 12px; }
.success { color: #3ecf8e; font-size: 12.5px; margin: 0 0 12px; }

.btn {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--bg);
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn-primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.danger { border-color: rgba(242, 114, 114, 0.35); }
.btn-danger { background: #f27272; border-color: #f27272; color: #fff; }
.danger-confirm { margin-top: 14px; }
.danger-actions { display: flex; gap: 10px; margin-top: 6px; }

@media (max-width: 640px) {
  .settings { padding: 32px 16px 48px; }
}
</style>