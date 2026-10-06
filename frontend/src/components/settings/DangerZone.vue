<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/authStore";
import api from "../../api/axios.js";

const authStore = useAuthStore();
const router = useRouter();

const deletePassword = ref("");
const deleteError = ref("");
const deleteConfirmOpen = ref(false);
const deleteSaving = ref(false);

async function deleteAccount() {
  deleteError.value = "";
  deleteSaving.value = true;
  try {
    await api.delete("/auth/me", { data: { password: deletePassword.value } });
    authStore.logout();
    router.push("/");
  } catch (err) {
    deleteError.value = err.response?.data?.error || "Error deleting account";
  } finally {
    deleteSaving.value = false;
  }
}

function cancelDelete() {
  deleteConfirmOpen.value = false;
  deletePassword.value = "";
  deleteError.value = "";
}
</script>

<template>
  <div class="settings-section">
    <div class="section-heading">
      <h2 id="danger-settings-heading">Danger Zone</h2>
      <p>Permanent account actions that cannot be undone.</p>
    </div>

    <section class="settings-card danger" aria-labelledby="delete-heading">
      <div class="card-heading">
        <h3 id="delete-heading">Delete account</h3>
        <p>This permanently deletes your account, reviews, watchlist, and Top 5. This action cannot be undone.</p>
      </div>

      <button v-if="!deleteConfirmOpen" class="btn btn-danger" type="button" @click="deleteConfirmOpen = true">
        Delete my account
      </button>

      <div v-else class="danger-confirm">
        <div class="field">
          <label for="delete-password">Confirm your password</label>
          <input id="delete-password" v-model="deletePassword" type="password" autocomplete="current-password" />
        </div>
        <p v-if="deleteError" class="error" role="alert">{{ deleteError }}</p>
        <div class="danger-actions">
          <button class="btn btn-danger" type="button" :disabled="deleteSaving" @click="deleteAccount">
            {{ deleteSaving ? "Deleting..." : "Yes, delete permanently" }}
          </button>
          <button class="btn" type="button" :disabled="deleteSaving" @click="cancelDelete">Cancel</button>
        </div>
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
.danger { border-color: rgba(242, 114, 114, 0.4); }
.field { margin-bottom: 15px; }
.field label { display: block; margin-bottom: 6px; color: var(--text-dim); font-size: 12px; font-weight: 600; }
.field input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; font-size: 13px; }
.field input:focus { outline: none; border-color: var(--blue); }
.danger-confirm { margin-top: 14px; }
.danger-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
.btn { padding: 9px 18px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-danger { border-color: #f27272; background: #f27272; color: #fff; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.error { margin: 0 0 12px; color: #f27272; font-size: 12.5px; }
@media (max-width: 480px) { .settings-card { padding: 18px; } }
</style>
