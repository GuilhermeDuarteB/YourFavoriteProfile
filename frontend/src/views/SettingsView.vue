<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import api from '../api/axios.js';
import NavBar from '../components/NavBar.vue';
import Footer from '../components/Footer.vue';

const authStore = useAuthStore();
const router = useRouter();

const newEmail = ref('');
const emailPassword = ref('');
const emailError = ref('');
const emailSuccess = ref('');
const emailSaving = ref(false);

const deletePassword = ref('');
const deleteError = ref('');
const deleteConfirmOpen = ref(false);

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
    emailSuccess.value = 'Email updated successfully.';
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
  try {
    await api.delete('/auth/me', { data: { password: deletePassword.value } });
    authStore.logout();
    router.push('/');
  } catch (err) {
    deleteError.value = err.response?.data?.error || 'Error deleting account';
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

      <section class="settings-card">
        <h3>Change email</h3>
        <p class="current">Current: {{ authStore.user?.email }}</p>
        <input v-model="newEmail" type="email" placeholder="New email" />
        <input v-model="emailPassword" type="password" placeholder="Confirm your password" />
        <p v-if="emailError" class="error">{{ emailError }}</p>
        <p v-if="emailSuccess" class="success">{{ emailSuccess }}</p>
        <button class="btn btn-primary" :disabled="emailSaving" @click="changeEmail">
          {{ emailSaving ? 'Saving...' : 'Update email' }}
        </button>
      </section>

      <section class="settings-card">
        <h3>Session</h3>
        <button class="btn" @click="handleLogout">Log out</button>
      </section>

      <section class="settings-card danger">
        <h3>Delete account</h3>
        <p class="warning-text">This permanently deletes your account, reviews, watchlist, and top 5. This cannot be undone.</p>

        <div v-if="!deleteConfirmOpen">
          <button class="btn btn-danger" @click="deleteConfirmOpen = true">Delete my account</button>
        </div>
        <div v-else>
          <input v-model="deletePassword" type="password" placeholder="Confirm your password" />
          <p v-if="deleteError" class="error">{{ deleteError }}</p>
          <div class="danger-actions">
            <button class="btn btn-danger" @click="deleteAccount">Yes, delete permanently</button>
            <button class="btn" @click="deleteConfirmOpen = false">Cancel</button>
          </div>
        </div>
      </section>
    </div>
    <Footer />
  </div>
</template>

<style scoped>
.settings {
  max-width: 560px;
  margin: 0 auto;
  padding: 48px 24px;
}
.settings h1 {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 24px;
}
.settings-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}
.settings-card h3 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}
.current {
  font-size: 12px;
  color: var(--text-mute);
  margin-bottom: 12px;
}
.settings-card input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 13px;
  margin-bottom: 10px;
  box-sizing: border-box;
}
.error { color: #f27272; font-size: 12px; margin-bottom: 10px; }
.success { color: #3ecf8e; font-size: 12px; margin-bottom: 10px; }
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
.btn-primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.danger { border-color: rgba(242, 114, 114, 0.3); }
.warning-text { font-size: 12px; color: var(--text-mute); margin-bottom: 16px; }
.btn-danger { background: #f27272; border-color: #f27272; color: #fff; }
.danger-actions { display: flex; gap: 10px; margin-top: 10px; }
</style>