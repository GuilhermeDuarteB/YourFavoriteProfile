<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/authStore";
import api from "../../api/axios.js";

const authStore = useAuthStore();
const router = useRouter();

const newUsername = ref("");
const usernamePassword = ref("");
const usernameError = ref("");
const usernameSuccess = ref("");
const usernameSaving = ref(false);

const newEmail = ref("");
const emailPassword = ref("");
const emailError = ref("");
const emailSuccess = ref("");
const emailSaving = ref(false);

async function changeUsername() {
  usernameError.value = "";
  usernameSuccess.value = "";
  usernameSaving.value = true;
  try {
    const res = await api.put("/auth/me/username", {
      newUsername: newUsername.value,
      password: usernamePassword.value,
    });
    authStore.user.username = res.data.username;
    localStorage.setItem("user", JSON.stringify(authStore.user));
    usernameSuccess.value = "Username updated.";
    usernamePassword.value = "";
    router.replace({ name: "settings", query: { section: "account" } });
  } catch (err) {
    usernameError.value =
      err.response?.data?.error || "Error updating username";
  } finally {
    usernameSaving.value = false;
  }
}

async function changeEmail() {
  emailError.value = "";
  emailSuccess.value = "";
  emailSaving.value = true;
  try {
    const res = await api.put("/auth/me/email", {
      newEmail: newEmail.value,
      password: emailPassword.value,
    });
    authStore.user.email = res.data.email;
    localStorage.setItem("user", JSON.stringify(authStore.user));
    emailSuccess.value = "Email updated.";
    newEmail.value = "";
    emailPassword.value = "";
  } catch (err) {
    emailError.value = err.response?.data?.error || "Error updating email";
  } finally {
    emailSaving.value = false;
  }
}
</script>

<template>
  <div class="settings-section">
    <div class="section-heading">
      <h2 id="account-settings-heading">Account</h2>
      <p>Update the credentials connected to your account.</p>
    </div>

    <section class="settings-card" aria-labelledby="username-heading">
      <div class="card-heading">
        <h3 id="username-heading">Username</h3>
        <p>
          Current username: <strong>@{{ authStore.user?.username }}</strong>
        </p>
      </div>

      <div class="field">
        <label for="new-username">New username</label>
        <input
          id="new-username"
          v-model="newUsername"
          type="text"
          autocomplete="username"
        />
      </div>
      <div class="field">
        <label for="username-password">Confirm your password</label>
        <input
          id="username-password"
          v-model="usernamePassword"
          type="password"
          autocomplete="current-password"
        />
      </div>

      <p v-if="usernameError" class="error" role="alert">{{ usernameError }}</p>
      <p v-if="usernameSuccess" class="success" role="status">
        {{ usernameSuccess }}
      </p>

      <button
        class="btn btn-primary"
        type="button"
        :disabled="usernameSaving"
        @click="changeUsername"
      >
        {{ usernameSaving ? "Saving..." : "Update username" }}
      </button>
    </section>

    <section class="settings-card" aria-labelledby="email-heading">
      <div class="card-heading">
        <h3 id="email-heading">Email</h3>
        <p>
          Current email: <strong>{{ authStore.user?.email }}</strong>
        </p>
      </div>

      <div class="field">
        <label for="new-email">New email</label>
        <input
          id="new-email"
          v-model="newEmail"
          type="email"
          autocomplete="email"
        />
      </div>
      <div class="field">
        <label for="email-password">Confirm your password</label>
        <input
          id="email-password"
          v-model="emailPassword"
          type="password"
          autocomplete="current-password"
        />
      </div>

      <p v-if="emailError" class="error" role="alert">{{ emailError }}</p>
      <p v-if="emailSuccess" class="success" role="status">
        {{ emailSuccess }}
      </p>

      <button
        class="btn btn-primary"
        type="button"
        :disabled="emailSaving"
        @click="changeEmail"
      >
        {{ emailSaving ? "Saving..." : "Update email" }}
      </button>
    </section>
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
.field input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}
.field input:focus {
  outline: none;
  border-color: var(--blue);
}
.field input:focus-visible,
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
.error {
  color: #f27272;
}
.success {
  color: #3ecf8e;
}
@media (max-width: 480px) {
  .settings-card {
    padding: 18px;
  }
}
</style>
