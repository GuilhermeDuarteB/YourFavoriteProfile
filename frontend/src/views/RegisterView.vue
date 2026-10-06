<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import AuthHero from "../components/AuthHero.vue";

const authStore = useAuthStore();
const router = useRouter();

const username = ref("");
const email = ref("");
const confirmEmail = ref("");
const password = ref("");
const confirmPassword = ref("");

const error = ref("");
const loading = ref(false);

async function handleSubmit() {
  error.value = "";

  if (email.value.trim().toLowerCase() !== confirmEmail.value.trim().toLowerCase()) {
    error.value = "Emails don't match";
    return;
  }

  if (password.value !== confirmPassword.value) {
    error.value = "Passwords don't match";
    return;
  }

  loading.value = true;

  try {
    await authStore.register({
      username: username.value,
      email: email.value,
      password: password.value,
    });

    router.push({
      name: "profile",
      params: {
        username: authStore.user.username,
      },
    });
  } catch (err) {
    error.value = err.response?.data?.error || "Error creating your account";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <AuthHero />

    <section class="register-panel">
      <div class="register-content">
        <!-- Header -->
        <header class="form-header">
          <img
            src="../assets/ifp-logo.png"
            alt="Your Favorite Profile"
            class="form-logo"
          />

          <h1>Create Your Account</h1>

          <p>Join and start building your favorite profile.</p>
        </header>

        <!-- Form -->
        <form @submit.prevent="handleSubmit">
          <!-- Username -->
          <div class="field">
            <label for="username">Username</label>

            <div class="input-wrap">
              <svg
                class="input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path d="M20 21a8 8 0 0 0-16 0" stroke-linecap="round" />

                <circle cx="12" cy="7" r="4" />
              </svg>

              <input
                id="username"
                minlength="3"
                maxlength="50"
                pattern="[a-zA-Z0-9_.]+"
                v-model="username"
                type="text"
                placeholder="Choose a username"
                autocomplete="username"
                required
              />
            </div>
          </div>

          <!-- Email -->
          <div class="field">
            <label for="email">Email</label>

            <div class="input-wrap">
              <svg
                class="input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />

                <path
                  d="m2 6 10 7 10-7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>

              <input
                id="email"
                v-model="email"
                type="email"
                placeholder="Enter your email"
                autocomplete="email"
                required
              />
            </div>
          </div>

          <!-- Confirm Email -->
          <div class="field">
            <label for="confirm-email"> Confirm email </label>

            <div class="input-wrap">
              <svg
                class="input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />

                <path
                  d="m2 6 10 7 10-7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>

              <input
                id="confirm-email"
                v-model="confirmEmail"
                type="email"
                placeholder="Repeat your email"
                autocomplete="email"
                required
              />
            </div>
          </div>

          <!-- Password -->
          <div class="field">
            <label for="password">Password</label>

            <div class="input-wrap">
              <svg
                class="input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <rect x="3" y="11" width="18" height="10" rx="2" />

                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round" />
              </svg>

              <input
                id="password"
                minlength="8"
                v-model="password"
                type="password"
                placeholder="Create a password"
                autocomplete="new-password"
                required
              />
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="field">
            <label for="confirm-password"> Confirm password </label>

            <div class="input-wrap">
              <svg
                class="input-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <rect x="3" y="11" width="18" height="10" rx="2" />

                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke-linecap="round" />
              </svg>

              <input
                id="confirm-password"
                v-model="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                autocomplete="new-password"
                required
              />
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <!-- Submit -->
          <button class="submit-button" type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>

            {{ loading ? "Creating account..." : "Create account" }}
          </button>

          <!-- Login -->
          <p class="switch">
            Already have an account?

            <router-link to="/login"> Log in </router-link>
          </p>
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  background: #0b0e13;
}


.register-panel {
  position: fixed;

  top: 0;
  right: 0;
  bottom: 0;

  width: 25%;
  min-width: 340px;

  display: flex;
  align-items: center;
  justify-content: center;

  box-sizing: border-box;

  padding: clamp(24px, 4vh, 48px) clamp(24px, 2.5vw, 44px);

  background: #171a23;

  overflow-y: auto;
}


.register-content {
  width: 100%;
  max-width: 390px;

  margin: auto;
}


.form-header {
  display: flex;
  flex-direction: column;
  align-items: center;

  text-align: center;

  margin-bottom: clamp(20px, 3vh, 30px);
}

.form-logo {
  width: clamp(54px, 7vh, 70px);
  height: clamp(54px, 7vh, 70px);

  object-fit: cover;

  border-radius: 14px;

  margin-bottom: clamp(12px, 1.8vh, 18px);

  box-shadow:
    0 8px 25px rgba(0, 0, 0, 0.18),
    0 0 20px rgba(20, 86, 253, 0.04);
}

.form-header h1 {
  margin: 0 0 7px;

  color: #f4f2ee;

  font-size: clamp(1.2rem, 2.3vh, 1.45rem);
  font-weight: 650;

  letter-spacing: -0.4px;
}

.form-header p {
  margin: 0;

  color: #8b8d98;

  font-size: 0.82rem;
  line-height: 1.45;
}

form {
  width: 100%;
}

.field {
  margin-bottom: clamp(10px, 1.45vh, 15px);
}

.field label {
  display: block;

  margin: 0 0 6px 2px;

  color: #c7c8d1;

  font-size: 0.76rem;
  font-weight: 550;
}


.input-wrap {
  position: relative;

  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;

  z-index: 2;

  left: 14px;

  width: 17px;
  height: 17px;

  color: #696d7a;

  pointer-events: none;

  transition: color 0.18s ease;
}

input {
  width: 100%;
  height: clamp(42px, 5.4vh, 48px);

  box-sizing: border-box;

  padding: 0 14px 0 42px;

  color: #f4f2ee;

  font-family: inherit;
  font-size: 0.86rem;

  border: 1px solid #2c303c;

  border-radius: 10px;

  outline: none;

  background: #21242f;

  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

input::placeholder {
  color: #626673;
}

.input-wrap:focus-within input {
  border-color: #3868dd;

  background: #222631;

  box-shadow: 0 0 0 3px rgba(20, 86, 253, 0.08);
}

.input-wrap:focus-within .input-icon {
  color: #4b7fff;
}

input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-text-fill-color: #f4f2ee;

  -webkit-box-shadow: 0 0 0 1000px #21242f inset;

  transition: background-color 9999s ease-in-out 0s;
}

.error-message {
  margin: 2px 0 10px;

  padding: 8px 10px;

  color: #ff8585;

  font-size: 0.76rem;
  text-align: center;

  border: 1px solid rgba(242, 114, 114, 0.15);

  border-radius: 8px;

  background: rgba(242, 114, 114, 0.06);
}

.submit-button {
  width: 100%;
  height: clamp(43px, 5.5vh, 49px);

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 9px;

  margin-top: clamp(5px, 1vh, 9px);

  color: white;

  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;

  border: none;
  border-radius: 10px;

  background: linear-gradient(135deg, #1456fd, #2469ff);

  cursor: pointer;

  box-shadow: 0 8px 20px rgba(20, 86, 253, 0.12);

  transition:
    transform 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}

.submit-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #2469ff, #3d79ff);

  box-shadow: 0 10px 25px rgba(20, 86, 253, 0.2);
}

.submit-button:active:not(:disabled) {
  transform: translateY(1px);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;

  border: 2px solid rgba(255, 255, 255, 0.35);

  border-top-color: white;

  border-radius: 50%;

  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.switch {
  margin: clamp(14px, 2vh, 20px) 0 0;

  color: #8b8d98;

  text-align: center;

  font-size: 0.8rem;
}

.switch a {
  margin-left: 3px;

  color: #2872ff;

  font-weight: 600;

  text-decoration: none;
}

.switch a:hover {
  text-decoration: underline;
}

@media (max-height: 760px) and (min-width: 769px) {
  .register-panel {
    padding-top: 16px;
    padding-bottom: 16px;
  }

  .form-header {
    margin-bottom: 14px;
  }

  .form-logo {
    width: 46px;
    height: 46px;

    margin-bottom: 8px;
  }

  .form-header h1 {
    font-size: 1.1rem;
    margin-bottom: 3px;
  }

  .form-header p {
    font-size: 0.72rem;
  }

  .field {
    margin-bottom: 8px;
  }

  .field label {
    margin-bottom: 4px;

    font-size: 0.7rem;
  }

  input {
    height: 38px;

    font-size: 0.8rem;
  }

  .submit-button {
    height: 40px;

    margin-top: 3px;
  }

  .switch {
    margin-top: 11px;

    font-size: 0.75rem;
  }
}

@media (max-width: 1024px) {
  .register-panel {
    width: 40%;

    padding-left: 28px;
    padding-right: 28px;
  }
}

@media (max-width: 768px) {
  .auth-page {
    min-height: 100dvh;

    background: #171a23;
  }

  .register-panel {
    position: static;

    width: 100%;
    min-width: 0;

    min-height: 100dvh;

    padding: 32px 22px;

    overflow: visible;
  }

  .register-content {
    max-width: 430px;
  }
}

@media (max-width: 380px) {
  .register-panel {
    padding: 24px 16px;
  }

  .form-header {
    margin-bottom: 18px;
  }
}
</style>
