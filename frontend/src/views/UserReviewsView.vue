<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "../api/axios.js";
import NavBar from "../components/NavBar.vue";
import Footer from "../components/Footer.vue";

const route = useRoute();
const router = useRouter();
const result = ref(null);
const availableGenres = ref([]);
const loading = ref(false);
const error = ref("");
const types = [
  { value: "", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "game", label: "Games" },
];
const ratings = [
  { value: "", label: "All ratings" },
  { value: "10", label: "5 stars" },
  { value: "8", label: "4+ stars" },
  { value: "6", label: "3+ stars" },
  { value: "4", label: "2+ stars" },
  { value: "2", label: "1+ star" },
];
const sorts = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];
const integer = (value, fallback, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === "string" &&
  /^\d+$/.test(value) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= max
    ? Number(value)
    : fallback;
const filters = computed(() => {
  const q = route.query;
  const score =
    typeof q.minScore === "string" &&
    q.minScore.trim() &&
    Number.isFinite(Number(q.minScore)) &&
    Number(q.minScore) > 0 &&
    Number(q.minScore) <= 10
      ? String(Number(q.minScore))
      : "";
  return {
    type: types.some((type) => type.value === q.type) ? q.type : "",
    genre:
      typeof q.genre === "string" && q.genre.length <= 100
        ? q.genre.trim()
        : "",
    minScore: score,
    sort: sorts.some((sort) => sort.value === q.sort) ? q.sort : "newest",
    page: integer(q.page, 1, Math.floor(Number.MAX_SAFE_INTEGER / 100)),
    pageSize: integer(q.pageSize, 20, 100),
  };
});
const hasFilters = computed(
  () => !!(filters.value.type || filters.value.genre || filters.value.minScore),
);
let requestVersion = 0;
let activeController;

function updateFilter(key, value) {
  const query = { ...route.query };
  if (value && !(key === "sort" && value === "newest")) query[key] = value;
  else delete query[key];
  delete query.page;
  router.push({
    name: "user-reviews",
    params: { username: route.params.username },
    query,
  });
}
function changePage(page) {
  router.push({
    name: "user-reviews",
    params: { username: route.params.username },
    query: { ...route.query, page: String(page) },
  });
}
async function loadReviews() {
  activeController?.abort();
  const controller = (activeController = new AbortController());
  const version = ++requestVersion;
  loading.value = true;
  error.value = "";
  result.value = null;
  const params = { ...filters.value };
  for (const key of ["type", "genre", "minScore"])
    if (!params[key]) delete params[key];
  try {
    const res = await api.get(
      `/users/${encodeURIComponent(route.params.username)}/reviews`,
      { params, signal: controller.signal },
    );
    if (version !== requestVersion || controller.signal.aborted) return;
    if (res.data.totalPages > 0 && params.page > res.data.totalPages) {
      await router.replace({
        name: "user-reviews",
        params: { username: route.params.username },
        query: { ...route.query, page: String(res.data.totalPages) },
      });
      return;
    }
    result.value = res.data;
    availableGenres.value = res.data.availableGenres;
  } catch (err) {
    if (version === requestVersion && !controller.signal.aborted)
      error.value =
        err.response?.status === 404
          ? "User not found"
          : "Unable to load reviews. Please try again.";
  } finally {
    if (version === requestVersion && !controller.signal.aborted)
      loading.value = false;
  }
}
function mediaLink(review) {
  return review.externalId &&
    ["movie", "series", "game"].includes(review.mediaType)
    ? `/${review.mediaType}/${encodeURIComponent(review.externalId)}`
    : null;
}
function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
watch(
  () => [route.params.username, ...Object.values(filters.value)],
  (values, previous, onCleanup) => {
    if (previous && values[0] !== previous[0]) availableGenres.value = [];
    void loadReviews();
    onCleanup(() => {
      requestVersion++;
      activeController?.abort();
    });
  },
  { immediate: true, flush: "sync" },
);
</script>

<template>
  <div>
    <NavBar />
    <main class="user-reviews-page">
      <header>
        <router-link
          :to="{ name: 'profile', params: { username: route.params.username } }"
          class="back-link"
          >← Back to profile</router-link
        >
        <h1>{{ route.params.username }}'s reviews</h1>
        <p v-if="result" class="muted" role="status">
          {{ result.total }} {{ result.total === 1 ? "review" : "reviews"
          }}{{ hasFilters ? " matching these filters" : "" }}
        </p>
      </header>
      <nav class="type-tabs" aria-label="Review types">
        <button
          v-for="type in types"
          :key="type.value"
          type="button"
          :class="{ active: filters.type === type.value }"
          :aria-pressed="filters.type === type.value"
          @click="updateFilter('type', type.value)"
        >
          {{ type.label }}
        </button>
      </nav>
      <div class="filters">
        <div class="filter">
          <label for="review-rating">Rating</label>
          <select
            id="review-rating"
            :value="filters.minScore"
            @change="updateFilter('minScore', $event.target.value)"
          >
            <option
              v-for="rating in ratings"
              :key="rating.value"
              :value="rating.value"
            >
              {{ rating.label }}
            </option>
            <option
              v-if="
                filters.minScore &&
                !ratings.some((rating) => rating.value === filters.minScore)
              "
              :value="filters.minScore"
            >
              {{ Number(filters.minScore) / 2 }}+ stars
            </option>
          </select>
        </div>
        <div class="filter">
          <label for="review-genre">Genre</label>
          <select
            id="review-genre"
            :value="filters.genre"
            @change="updateFilter('genre', $event.target.value)"
          >
            <option value="">All genres</option>
            <option
              v-for="genre in availableGenres"
              :key="genre"
              :value="genre"
            >
              {{ genre }}
            </option>
            <option
              v-if="filters.genre && !availableGenres.includes(filters.genre)"
              :value="filters.genre"
            >
              {{ filters.genre }}
            </option>
          </select>
        </div>
        <div class="filter">
          <label for="review-sort">Sort</label>
          <select
            id="review-sort"
            :value="filters.sort"
            @change="updateFilter('sort', $event.target.value)"
          >
            <option v-for="sort in sorts" :key="sort.value" :value="sort.value">
              {{ sort.label }}
            </option>
          </select>
        </div>
      </div>
      <p v-if="loading" role="status" class="state">Loading reviews...</p>
      <p v-else-if="error" role="alert" class="state">
        {{ error }}
        <button
          v-if="error !== 'User not found'"
          type="button"
          class="button"
          @click="loadReviews"
        >
          Retry
        </button>
      </p>
      <template v-else-if="result">
        <p v-if="!result.totalUserReviews" class="state">
          This user hasn't reviewed anything yet.
        </p>
        <p v-else-if="!result.reviews.length" class="state">
          No reviews match these filters.
        </p>
        <div v-else class="reviews">
          <article
            v-for="review in result.reviews"
            :key="review.id"
            class="review-card"
          >
            <router-link
              v-if="mediaLink(review)"
              :to="mediaLink(review)"
              class="poster-link"
              :aria-label="`View ${review.mediaTitle}`"
            >
              <img
                v-if="review.posterUrl"
                :src="review.posterUrl"
                alt=""
                loading="lazy"
                class="poster"
              />
              <span v-else class="poster placeholder" aria-hidden="true">{{
                review.mediaType
              }}</span>
            </router-link>
            <div v-else class="poster placeholder" aria-hidden="true">
              {{ review.mediaType }}
            </div>
            <div class="review-content">
              <div class="review-heading">
                <h2>
                  <router-link
                    v-if="mediaLink(review)"
                    :to="mediaLink(review)"
                    >{{ review.mediaTitle }}</router-link
                  ><span v-else>{{ review.mediaTitle }}</span>
                </h2>
                <span
                  class="review-score"
                  :aria-label="`${Number(review.score).toFixed(1)} out of 10`"
                  >★ {{ Number(review.score).toFixed(1) }}</span
                >
              </div>
              <p v-if="review.episodeId" class="episode-label">
                S{{ String(review.seasonNumber).padStart(2, "0") }}E{{
                  String(review.episodeNumber).padStart(2, "0")
                }}
                · {{ review.episodeTitle }}
              </p>
              <p v-else class="muted">
                {{
                  review.mediaType === "series"
                    ? "Legacy series review"
                    : review.mediaType === "game"
                      ? "Game review"
                      : "Movie review"
                }}
              </p>
              <p class="comment">{{ review.comment || "No comment left." }}</p>
              <time :datetime="review.createdAt"
                >Reviewed {{ formatDate(review.createdAt) }}</time
              >
            </div>
          </article>
        </div>
        <nav
          v-if="result.totalPages > 1"
          class="pagination"
          aria-label="Reviews pagination"
        >
          <button
            type="button"
            class="button"
            :disabled="result.page <= 1"
            @click="changePage(result.page - 1)"
          >
            Previous
          </button>
          <span>Page {{ result.page }} of {{ result.totalPages }}</span>
          <button
            type="button"
            class="button"
            :disabled="result.page >= result.totalPages"
            @click="changePage(result.page + 1)"
          >
            Next
          </button>
        </nav>
      </template>
    </main>
    <Footer />
  </div>
</template>

<style scoped>
.user-reviews-page {
  padding: 32px 56px 48px;
  min-width: 0;
}
h1 {
  margin: 16px 0 8px;
  overflow-wrap: anywhere;
}
.back-link {
  color: var(--blue);
  font-size: 13px;
}
.muted,
time,
.episode-label {
  color: var(--text-dim);
  font-size: 13px;
}
.type-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px;
  margin: 20px -4px;
}
.type-tabs button,
.button {
  padding: 10px 16px;
  min-height: 42px;
  border: 1px solid var(--border, #293041);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.type-tabs button {
  flex-shrink: 0;
}
.type-tabs button.active {
  color: var(--blue);
  border-color: var(--blue);
  background: rgba(47, 91, 255, 0.15);
}
.filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
label {
  font-size: 12px;
  color: var(--text-dim);
}
select {
  width: 100%;
  min-width: 0;
  padding: 11px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border, #293041);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
}
.state {
  color: var(--text-dim);
  padding: 32px 0;
}
[role="alert"] {
  color: #f27272;
}
.reviews {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 28px;
}
.review-card {
  display: flex;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--border, #293041);
  border-radius: 12px;
  background: var(--bg-card);
}
.poster-link,
.poster {
  width: 80px;
  flex-shrink: 0;
}
.poster {
  height: 120px;
  object-fit: cover;
  border-radius: 7px;
  display: block;
}
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--navy);
  color: var(--text-mute);
  font-size: 11px;
}
.review-content {
  min-width: 0;
  flex: 1;
}
.review-heading {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  flex-wrap: wrap;
}
h2 {
  margin: 0;
  font-size: 16px;
  overflow-wrap: anywhere;
}
h2 a {
  color: var(--text);
}
.review-score {
  color: var(--amber);
  white-space: nowrap;
  font-weight: 700;
}
.episode-label {
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.comment {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.6;
}
time {
  font-size: 11px;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 28px;
  font-size: 13px;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
button:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
@media (max-width: 768px) {
  .user-reviews-page {
    padding: 24px;
  }
}
@media (max-width: 540px) {
  .filters {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .review-card {
    padding: 14px;
    gap: 12px;
  }
  .poster-link,
  .poster {
    width: 54px;
  }
  .poster {
    height: 81px;
  }
}
</style>
