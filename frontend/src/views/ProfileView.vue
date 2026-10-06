<script setup>
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";
import FollowButton from "../components/FollowButton.vue";
import GenreRadar from "../components/GenreRadar.vue";

const route = useRoute();
const authStore = useAuthStore();

const profile = ref(null);
const loading = ref(true);
const error = ref("");

const isOwnProfile = computed(
  () => authStore.user?.username === route.params.username,
);

async function loadProfile() {
  loading.value = true;
  error.value = "";
  try {
    const res = await api.get(`/users/${route.params.username}`);
    profile.value = res.data;
  } catch (err) {
    error.value =
      err.response?.status === 404 ? "User not found" : "Error loading profile";
  } finally {
    loading.value = false;
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function updateFollowing(following) {
  if (profile.value.viewerFollows === following) return;
  profile.value.viewerFollows = following;
  profile.value.followCounts.followers += following ? 1 : -1;
}

watch(() => route.params.username, loadProfile, { immediate: true });
</script>

<template>
  <div class="page">
    <NavBar />

    <div v-if="loading" class="state-message">Loading...</div>
    <div v-else-if="error" class="state-message">{{ error }}</div>

    <div v-else-if="profile" class="profile">
      <div class="hero">
        <div class="hero-left">
          <div
            class="avatar"
            :style="
              profile.avatarUrl
                ? { backgroundImage: `url(${profile.avatarUrl})` }
                : {}
            "
          >
            <span v-if="!profile.avatarUrl">{{
              profile.username[0].toUpperCase()
            }}</span>
          </div>
          <div class="hero-info">
            <h1>{{ profile.username }}</h1>
            <p class="joined">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="icon-sm"
              >
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M16 2v4M8 2v4M3 10h18"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Member since {{ formatDate(profile.createdAt) }}
            </p>
            <p class="bio">
              {{
                profile.bio ||
                (isOwnProfile
                  ? "Add a bio to tell people about yourself."
                  : "No bio yet.")
              }}
            </p>

            <router-link v-if="isOwnProfile" to="/settings" class="btn">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="icon-sm"
              >
                <path
                  d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Edit profile
            </router-link>
            <FollowButton
              v-else-if="authStore.isAuthenticated"
              :username="profile.username"
              :initial-following="profile.viewerFollows"
              @changed="updateFollowing"
            />
          </div>
        </div>

        <GenreRadar :data="profile.genreBreakdown" />
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ profile.stats.reviewCount }}</div>
          <div class="stat-label">Reviews</div>
        </div>
        <div class="stat-card">
          <div class="stat-value accent">
            {{ profile.stats.avgScore ?? "—" }}
          </div>
          <div class="stat-label">Avg. score given</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ profile.followCounts.followers }}</div>
          <div class="stat-label">Followers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ profile.followCounts.following }}</div>
          <div class="stat-label">Following</div>
        </div>
      </div>

      <section class="section">
        <div class="section-head">
          <h2><span class="bar"></span>Recent reviews</h2>
        </div>
        <div v-if="profile.recentReviews.length === 0" class="empty-state">
          No reviews yet.
        </div>
        <div v-else class="review-list">
          <div
            v-for="r in profile.recentReviews"
            :key="r.id"
            class="review-row"
          >
            <div
              class="review-poster"
              :style="
                r.poster_url ? { backgroundImage: `url(${r.poster_url})` } : {}
              "
            ></div>
            <div class="review-info">
              <div class="review-title">{{ r.title }}</div>
              <div class="review-comment" v-if="r.comment">{{ r.comment }}</div>
              <div class="review-comment placeholder" v-else>
                No comment left
              </div>
            </div>
            <div class="review-score">★ {{ r.score }}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2><span class="bar"></span>Top 5</h2>
        </div>

        <div
          v-if="!profile.topFive || profile.topFive.length === 0"
          class="empty-state coming-soon"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            class="icon-lg"
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <p>
            {{
              isOwnProfile
                ? "You haven't set your top 5 yet."
                : `${profile.username} hasn't set a top 5 yet.`
            }}
          </p>
          <router-link v-if="isOwnProfile" to="/settings" class="btn"
            >Set your top 5</router-link
          >
        </div>

        <div v-else class="top-five-grid">
          <router-link
            v-for="item in profile.topFive"
            :key="item.media_id"
            :to="`/${item.type}/${item.external_id}`"
            class="top-five-item"
          >
            <div class="top-five-rank">#{{ item.rank }}</div>
            <div
              class="top-five-poster"
              :style="
                item.poster_url
                  ? { backgroundImage: `url(${item.poster_url})` }
                  : {}
              "
            ></div>
            <div class="top-five-title">{{ item.title }}</div>
          </router-link>
        </div>
      </section>
    </div>

    <Footer />
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.state-message {
  text-align: center;
  color: var(--text-mute);
  padding: 100px 0;
  font-size: 14px;
}

.hero {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 40px;
  align-items: center;
  padding: 56px 56px 48px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}
.hero::before {
  content: "";
  position: absolute;
  top: -160px;
  left: -120px;
  width: 480px;
  height: 480px;
  background: radial-gradient(circle, rgba(47, 91, 255, 0.12), transparent 70%);
  pointer-events: none;
}

.hero-left {
  position: relative;
  display: flex;
  gap: 28px;
  z-index: 1;
}

.avatar {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--blue), var(--navy));
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  border: 3px solid var(--bg-card);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.hero-info h1 {
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 6px;
  color: var(--text);
  letter-spacing: -0.3px;
}
.joined {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-mute);
  margin: 0 0 14px;
}
.bio {
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1.5;
  margin: 0 0 16px;
  max-width: 460px;
}

.icon-sm {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.icon-lg {
  width: 30px;
  height: 30px;
  color: var(--text-mute);
  margin-bottom: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--bg-card);
  cursor: pointer;
  text-decoration: none;
  transition: border-color 0.15s ease;
}
.btn:hover {
  border-color: var(--blue);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  padding: 28px 56px;
  border-bottom: 1px solid var(--border);
}
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  text-align: center;
  transition: border-color 0.15s ease;
}
.stat-card:hover {
  border-color: rgba(47, 91, 255, 0.4);
}
.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text);
}
.stat-value.accent {
  color: var(--amber);
}
.stat-label {
  font-size: 11px;
  color: var(--text-mute);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.section {
  padding: 36px 56px;
  border-bottom: 1px solid var(--border);
}
.section-head {
  margin-bottom: 18px;
}
.section h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}
.bar {
  width: 3px;
  height: 15px;
  background: var(--blue);
  border-radius: 2px;
  display: inline-block;
}

.empty-state {
  color: var(--text-mute);
  font-size: 13px;
}
.empty-state.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 20px;
  background: var(--bg-card);
  border: 1px dashed var(--border);
  border-radius: 12px;
}
.empty-state.coming-soon p {
  margin: 0;
  max-width: 280px;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.review-row {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 18px;
  transition: border-color 0.15s ease;
}
.review-row:hover {
  border-color: rgba(47, 91, 255, 0.3);
}
.review-poster {
  width: 44px;
  height: 62px;
  border-radius: 7px;
  background-color: var(--navy);
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
}
.review-info {
  flex: 1;
  min-width: 0;
}
.review-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 3px;
}
.review-comment {
  font-size: 12.5px;
  color: var(--text-mute);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.review-comment.placeholder {
  font-style: italic;
  opacity: 0.6;
}
.review-score {
  font-size: 15px;
  font-weight: 800;
  color: var(--amber);
  flex-shrink: 0;
  background: rgba(240, 180, 41, 0.1);
  padding: 4px 10px;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 40px 24px;
    text-align: center;
  }
  .hero-left {
    flex-direction: column;
    align-items: center;
  }
  .bio {
    max-width: 100%;
  }
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
    padding: 20px 24px;
  }
  .section {
    padding: 28px 24px;
  }
}

.top-five-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}
.top-five-item {
  position: relative;
  text-decoration: none;
  color: var(--text);
}
.top-five-rank {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(11, 13, 18, 0.85);
  color: var(--amber);
  font-size: 12px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 6px;
  z-index: 1;
}
.top-five-poster {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 10px;
  background-color: var(--navy);
  background-size: cover;
  background-position: center;
  margin-bottom: 6px;
}
.top-five-title {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .top-five-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
