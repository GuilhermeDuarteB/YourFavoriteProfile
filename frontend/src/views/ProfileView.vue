<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import api from '../api/axios.js';
import NavBar from '../components/NavBar.vue';
import Footer from '../components/Footer.vue';

const route = useRoute();
const authStore = useAuthStore();

const profile = ref(null);
const loading = ref(true);
const error = ref('');
const editing = ref(false);
const editBio = ref('');
const saving = ref(false);

const isOwnProfile = computed(() => authStore.user?.username === route.params.username);

async function loadProfile() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.get(`/users/${route.params.username}`);
    profile.value = res.data;
    editBio.value = res.data.bio || '';
  } catch (err) {
    error.value = err.response?.status === 404 ? 'User not found' : 'Error loading profile';
  } finally {
    loading.value = false;
  }
}

async function saveBio() {
  saving.value = true;
  try {
    await api.put('/users/me', { bio: editBio.value, avatarUrl: profile.value.avatarUrl });
    profile.value.bio = editBio.value;
    editing.value = false;
  } catch (err) {
    console.error(err);
  } finally {
    saving.value = false;
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

watch(() => route.params.username, loadProfile, { immediate: true });
</script>

<template>
  <div>
    <NavBar />

    <div v-if="loading" class="state-message">Loading...</div>
    <div v-else-if="error" class="state-message">{{ error }}</div>

    <div v-else-if="profile" class="profile">
      <div class="hero">
        <div class="avatar" :style="profile.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})` } : {}">
          <span v-if="!profile.avatarUrl">{{ profile.username[0].toUpperCase() }}</span>
        </div>
        <div class="hero-info">
          <h1>{{ profile.username }}</h1>
          <p class="joined">Member since {{ formatDate(profile.createdAt) }}</p>

          <div v-if="!editing">
            <p class="bio">{{ profile.bio || (isOwnProfile ? 'Add a bio to tell people about yourself.' : 'No bio yet.') }}</p>
            <button v-if="isOwnProfile" class="btn" @click="editing = true">Edit profile</button>
          </div>
          <div v-else class="bio-edit">
            <textarea v-model="editBio" placeholder="Write something about yourself..." maxlength="280"></textarea>
            <div class="bio-actions">
              <button class="btn btn-primary" :disabled="saving" @click="saveBio">{{ saving ? 'Saving...' : 'Save' }}</button>
              <button class="btn" @click="editing = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ profile.stats.reviewCount }}</div>
          <div class="stat-label">Reviews</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ profile.stats.avgScore ?? '—' }}</div>
          <div class="stat-label">Avg. score given</div>
        </div>
      </div>

      <section class="section">
        <h2>Recent reviews</h2>
        <div v-if="profile.recentReviews.length === 0" class="empty-state">No reviews yet.</div>
        <div v-else class="review-list">
          <div v-for="r in profile.recentReviews" :key="r.id" class="review-row">
            <div class="review-poster" :style="r.poster_url ? { backgroundImage: `url(${r.poster_url})` } : {}"></div>
            <div class="review-info">
              <div class="review-title">{{ r.title }}</div>
              <div class="review-comment" v-if="r.comment">{{ r.comment }}</div>
            </div>
            <div class="review-score">★ {{ r.score }}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Top 5</h2>
        <div class="empty-state">
          {{ isOwnProfile ? "You haven't set your top 5 yet — coming soon." : `${profile.username} hasn't set a top 5 yet.` }}
        </div>
      </section>
    </div>

    <Footer />
  </div>
</template>

<style scoped>
.state-message { text-align: center; color: var(--text-mute); padding: 80px 0; }

.hero {
  display: flex;
  gap: 28px;
  padding: 48px 56px;
  border-bottom: 1px solid var(--border);
}

.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--blue), var(--navy));
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.hero-info h1 { font-size: 26px; font-weight: 800; margin-bottom: 4px; }
.joined { font-size: 12px; color: var(--text-mute); margin-bottom: 12px; }
.bio { font-size: 14px; color: var(--text-dim); margin-bottom: 12px; max-width: 500px; }

.bio-edit textarea {
  width: 100%;
  max-width: 500px;
  min-height: 70px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}
.bio-actions { display: flex; gap: 10px; margin-top: 10px; }

.btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--bg-card);
  cursor: pointer;
}
.btn-primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

.stats-row {
  display: flex;
  gap: 14px;
  padding: 24px 56px;
  border-bottom: 1px solid var(--border);
}
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 22px;
  text-align: center;
}
.stat-value { font-size: 22px; font-weight: 800; color: var(--amber); }
.stat-label { font-size: 11px; color: var(--text-mute); margin-top: 2px; }

.section { padding: 32px 56px; border-bottom: 1px solid var(--border); }
.section h2 { font-size: 17px; font-weight: 700; margin-bottom: 16px; }
.empty-state { color: var(--text-mute); font-size: 13px; }

.review-list { display: flex; flex-direction: column; gap: 10px; }
.review-row {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 16px;
}
.review-poster {
  width: 40px;
  height: 56px;
  border-radius: 6px;
  background-color: var(--navy);
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}
.review-info { flex: 1; min-width: 0; }
.review-title { font-size: 13px; font-weight: 700; }
.review-comment { font-size: 12px; color: var(--text-mute); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-score { font-size: 14px; font-weight: 800; color: var(--amber); flex-shrink: 0; }

@media (max-width: 768px) {
  .hero { flex-direction: column; align-items: center; text-align: center; padding: 32px 24px; }
  .stats-row, .section { padding: 20px 24px; }
}
</style>