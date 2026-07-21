<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await authStore.login({ email: email.value, password: password.value });
    router.push({ name: 'profile', params: { username: authStore.user.username } });
  } catch (err) {
    error.value = err.response?.data?.error || 'Login Error';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="form">
    <div class="form-logo">
      <img src="../assets/ifp-logo.png" alt="" />
      <h1>Welcome Back</h1>
      <p class="subtitle">Log in to continue your journey!</p>
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="field">
        <label>Email</label>
        <div class="input-wrap">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="4" width="20" height="16" rx="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="m2 6 10 7 10-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <input v-model="email" type="email" placeholder="Enter your email" required />
        </div>
      </div>

      <div class="field">
        <label>Password</label>
        <div class="input-wrap">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="11" width="18" height="10" rx="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <input v-model="password" type="password" placeholder="Enter your password" required />
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Logging in...' : 'Login' }}
      </button>

      <p class="switch">
        Don't have an account? <router-link to="/register">Register</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.form {
  background-color: #171a23;
  position: absolute;
  top: 0;
  right: 0;
  width: 25%;
  min-width: 340px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0 40px;
  box-sizing: border-box;
  overflow-y: auto;
}

.form-logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 32px;
}

.form-logo img {
  height: 72px;
  width: 72px;
  object-fit: cover;
  border-radius: 20%;
  margin-bottom: 20px;
}

.form-logo h1 {
  color: #f4f2ee;
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0 0 8px;
}

.form-logo .subtitle {
  color: #8b8d98;
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.4;
}

form {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  color: #c7c8d1;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 6px;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: #6b6d78;
  pointer-events: none;
}

input {
  width: 100%;
  background-color: #21242f;
  border: 1px solid #2c2f3b;
  border-radius: 10px;
  padding: 12px 14px 12px 42px;
  color: #f4f2ee;
  font-size: 0.9rem;
  box-sizing: border-box;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

input::placeholder {
  color: #5c5e68;
}

input:focus {
  outline: none;
  border-color: #4e5469;
  background-color: #23262f;
}

button {
  margin-top: 8px;
  background-color: #1456fd;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 13px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

button:hover:not(:disabled) {
  background-color: #507ef3;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #f27272;
  font-size: 0.82rem;
  margin: -4px 0 12px;
  text-align: center;
}

.switch {
  margin-top: 20px;
  text-align: center;
  color: #8b8d98;
  font-size: 0.85rem;
}

.switch a {
  color: #1456fd;
  text-decoration: none;
  font-weight: 500;
}

.switch a:hover {
  text-decoration: underline;
}

@media (max-width: 1024px) {
  .form {
    width: 40%;
  }
}

@media (max-width: 768px) {
  .form {
    position: static;
    width: 100%;
    min-width: 0;
    height: auto;
    min-height: 100vh;
    padding: 60px 24px;
  }

  .form-logo img {
    height: 60px;
    width: 60px;
  }

  .form-logo h1 {
    font-size: 1.25rem;
  }
}

@media (max-width: 380px) {
  .form {
    padding: 40px 16px;
  }
}
</style>