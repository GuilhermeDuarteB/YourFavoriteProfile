<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import api from "../../api/axios.js";

const props = defineProps({
  username: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["saved"]);

const ranks = [1, 2, 3, 4, 5];
const items = ref([]);
const loading = ref(false);
const loadError = ref("");
const searchQuery = ref("");
const searchResults = ref([]);
const searchLoading = ref(false);
const searchError = ref("");
const searchMessage = ref("");
const targetRank = ref(null);
const resolvingResult = ref(null);
const saving = ref(false);
const saveError = ref("");
const saveSuccess = ref("");

let searchTimer = null;
let searchRequestId = 0;

const sortedItems = computed(() =>
  [...items.value].sort((a, b) => a.rank - b.rank),
);

function normalizeItem(item) {
  const mediaId = Number(item?.mediaId ?? item?.media_id);
  const rank = Number(item?.rank);
  if (
    !Number.isSafeInteger(mediaId) ||
    mediaId <= 0 ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > 5
  ) {
    return null;
  }

  return {
    mediaId,
    rank,
    externalId: String(item.externalId ?? item.external_id ?? ""),
    type: item.type || "",
    title: item.title || "Untitled",
    posterUrl: item.posterUrl ?? item.poster_url ?? null,
  };
}

function applyExistingItems(value) {
  const next = Array.isArray(value)
    ? value.map(normalizeItem).filter(Boolean)
    : [];
  const unique = [];
  const mediaIds = new Set();
  const ranksSeen = new Set();
  for (const item of next) {
    if (mediaIds.has(item.mediaId) || ranksSeen.has(item.rank)) continue;
    mediaIds.add(item.mediaId);
    ranksSeen.add(item.rank);
    unique.push(item);
  }
  items.value = unique;
}

async function loadTopFive() {
  if (!props.username) return;
  loading.value = true;
  loadError.value = "";
  try {
    const res = await api.get(
      `/top-five/${encodeURIComponent(props.username)}`,
    );
    applyExistingItems(res.data);
  } catch (err) {
    loadError.value = err.response?.data?.error || "Error loading Top 5";
  } finally {
    loading.value = false;
  }
}

function clearSearch() {
  searchRequestId += 1;
  searchResults.value = [];
  searchLoading.value = false;
  searchError.value = "";
  searchMessage.value = "";
}

async function searchMedia() {
  const query = searchQuery.value.trim();
  const requestId = ++searchRequestId;
  searchError.value = "";
  searchMessage.value = "";
  if (query.length < 2) {
    searchResults.value = [];
    searchLoading.value = false;
    if (query) searchMessage.value = "Type at least 2 characters to search.";
    return;
  }

  searchLoading.value = true;
  try {
    const res = await api.get("/media/discover", {
      params: { query, types: "movie,series,game", page: 1 },
    });
    if (requestId !== searchRequestId) return;
    searchResults.value = res.data?.results || [];
  } catch (err) {
    if (requestId !== searchRequestId) return;
    searchResults.value = [];
    searchError.value =
      err.response?.data?.error || "Unable to search media. Please try again.";
  } finally {
    if (requestId === searchRequestId) searchLoading.value = false;
  }
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  if (!searchQuery.value.trim()) {
    clearSearch();
    return;
  }
  searchTimer = setTimeout(searchMedia, 350);
}

function firstAvailableRank() {
  return (
    ranks.find((rank) => !items.value.some((item) => item.rank === rank)) ||
    null
  );
}

function chooseRank(rank) {
  targetRank.value = rank;
  searchMessage.value = `Choose a title for #${rank}.`;
}

function replaceItem(rank) {
  chooseRank(rank);
}

function removeItem(rank) {
  items.value = items.value.filter((item) => item.rank !== rank);
  if (targetRank.value === rank) targetRank.value = null;
  saveError.value = "";
  saveSuccess.value = "";
}

function changeRank(item, nextRank) {
  const rank = Number(nextRank);
  if (!ranks.includes(rank) || rank === item.rank) return;
  const other = items.value.find(
    (candidate) => candidate !== item && candidate.rank === rank,
  );
  if (other) other.rank = item.rank;
  item.rank = rank;
  items.value = [...items.value];
  saveError.value = "";
  saveSuccess.value = "";
}

async function selectSearchResult(result) {
  const rank = targetRank.value ?? firstAvailableRank();
  if (!rank) {
    searchError.value =
      "Your Top 5 is full. Choose Replace on an existing item first.";
    return;
  }

  resolvingResult.value = result;
  searchError.value = "";
  searchMessage.value = "Resolving media...";
  try {
    const externalId = String(result.id);
    const res = await api.get(
      `/media/${result.type}/${encodeURIComponent(externalId)}`,
    );
    const resolved = normalizeItem({
      ...result,
      ...res.data,
      mediaId: res.data?.mediaId,
      externalId: res.data?.externalId ?? externalId,
      posterUrl: res.data?.posterUrl ?? result.posterUrl,
      type: res.data?.type ?? result.type,
      rank,
    });
    if (!resolved)
      throw new Error(
        "Media details did not include a valid internal media ID",
      );

    const duplicate = items.value.some(
      (item) => item.mediaId === resolved.mediaId && item.rank !== rank,
    );
    if (duplicate) {
      searchError.value = "That title is already in your Top 5.";
      searchMessage.value = "";
      return;
    }

    resolved.rank = rank;
    const index = items.value.findIndex((item) => item.rank === rank);
    if (index === -1) items.value = [...items.value, resolved];
    else
      items.value = items.value.map((item, itemIndex) =>
        itemIndex === index ? resolved : item,
      );
    targetRank.value = null;
    searchQuery.value = "";
    searchResults.value = [];
    searchMessage.value = "Title added to your Top 5.";
    saveError.value = "";
    saveSuccess.value = "";
  } catch (err) {
    searchError.value =
      err.response?.data?.error ||
      err.message ||
      "Unable to add this title. Please try again.";
    searchMessage.value = "";
  } finally {
    resolvingResult.value = null;
  }
}

async function saveTopFive() {
  saveError.value = "";
  saveSuccess.value = "";
  const mediaIds = new Set();
  const ranksSeen = new Set();
  if (
    items.value.some((item) => {
      if (mediaIds.has(item.mediaId) || ranksSeen.has(item.rank)) return true;
      mediaIds.add(item.mediaId);
      ranksSeen.add(item.rank);
      return false;
    })
  ) {
    saveError.value = "Top 5 entries must use unique media and ranks.";
    return;
  }

  saving.value = true;
  try {
    const payload = {
      items: sortedItems.value.map(({ mediaId, rank }) => ({ mediaId, rank })),
    };
    const res = await api.put("/top-five", payload);
    if (Array.isArray(res.data)) applyExistingItems(res.data);
    saveSuccess.value = "Top 5 updated.";
    emit("saved");
  } catch (err) {
    saveError.value = err.response?.data?.error || "Error updating Top 5";
  } finally {
    saving.value = false;
  }
}

watch(() => props.username, loadTopFive, { immediate: true });
watch(searchQuery, scheduleSearch);
onBeforeUnmount(() => clearTimeout(searchTimer));
</script>

<template>
  <section
    id="top-five"
    class="settings-card top-five-editor"
    aria-labelledby="top-five-heading"
  >
    <div class="card-heading">
      <h3 id="top-five-heading">Top 5</h3>
      <p>
        Choose up to five movies, series, or games to feature on your public
        profile.
      </p>
    </div>

    <p v-if="loading" class="state-message" role="status">
      Loading your Top 5...
    </p>
    <p v-else-if="loadError" class="error" role="alert">{{ loadError }}</p>

    <template v-else>
      <div class="top-five-slots">
        <article
          v-for="rank in ranks"
          :key="rank"
          class="top-five-slot"
          :class="{ occupied: items.some((item) => item.rank === rank) }"
        >
          <div class="slot-heading">
            <span class="slot-rank">#{{ rank }}</span>
            <span
              v-if="items.some((item) => item.rank === rank)"
              class="slot-label"
              >Selected</span
            >
          </div>

          <template v-if="items.some((item) => item.rank === rank)">
            <div
              v-for="item in items.filter(
                (candidate) => candidate.rank === rank,
              )"
              :key="item.mediaId"
              class="selected-media"
            >
              <img
                v-if="item.posterUrl"
                :src="item.posterUrl"
                :alt="`${item.title} poster`"
                class="selected-poster"
              />
              <div
                v-else
                class="selected-poster poster-placeholder"
                aria-hidden="true"
              >
                ★
              </div>
              <div class="selected-details">
                <strong>{{ item.title }}</strong>
                <span>{{ item.type }}</span>
              </div>
              <label class="rank-control">
                <span>Rank</span>
                <select
                  :value="item.rank"
                  :aria-label="`Rank for ${item.title}`"
                  @change="changeRank(item, $event.target.value)"
                >
                  <option v-for="option in ranks" :key="option" :value="option">
                    #{{ option }}
                  </option>
                </select>
              </label>
            </div>
            <div class="slot-actions">
              <button
                type="button"
                class="text-button"
                @click="replaceItem(rank)"
              >
                Replace
              </button>
              <button
                type="button"
                class="text-button danger-text"
                @click="removeItem(rank)"
              >
                Remove
              </button>
            </div>
          </template>
          <template v-else>
            <div class="empty-slot">No title selected</div>
            <button type="button" class="text-button" @click="chooseRank(rank)">
              Add media
            </button>
          </template>
        </article>
      </div>

      <div class="media-search">
        <label for="top-five-search">Search for a title</label>
        <input
          id="top-five-search"
          v-model="searchQuery"
          type="search"
          placeholder="Search movies, series, and games..."
          autocomplete="off"
        />
        <p v-if="targetRank" class="search-help" role="status">
          Selecting a result will fill slot #{{ targetRank }}.
        </p>
        <p v-if="searchLoading" class="state-message" role="status">
          Searching...
        </p>
        <p v-else-if="searchError" class="error" role="alert">
          {{ searchError }}
        </p>
        <p v-else-if="searchMessage" class="search-help" role="status">
          {{ searchMessage }}
        </p>
        <p
          v-else-if="searchQuery.trim().length >= 2 && !searchResults.length"
          class="search-help"
        >
          No results found.
        </p>

        <div
          v-if="searchResults.length"
          class="search-results"
          aria-label="Media search results"
        >
          <button
            v-for="result in searchResults"
            :key="`${result.type}-${result.id}`"
            type="button"
            class="search-result"
            :disabled="resolvingResult === result"
            @click="selectSearchResult(result)"
          >
            <img
              v-if="result.posterUrl"
              :src="result.posterUrl"
              :alt="`${result.title} poster`"
            />
            <span v-else class="result-placeholder" aria-hidden="true">★</span>
            <span class="result-details">
              <strong>{{ result.title }}</strong>
              <small
                >{{ result.type
                }}<span v-if="result.meta"> · {{ result.meta }}</span></small
              >
            </span>
            <span class="result-action">{{
              resolvingResult === result ? "Adding..." : "Add"
            }}</span>
          </button>
        </div>
      </div>

      <p v-if="saveError" class="error" role="alert">{{ saveError }}</p>
      <p v-if="saveSuccess" class="success" role="status">{{ saveSuccess }}</p>
      <button
        class="btn btn-primary save-button"
        type="button"
        :disabled="saving"
        @click="saveTopFive"
      >
        {{ saving ? "Saving..." : "Save Top 5" }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.top-five-editor {
  scroll-margin-top: 88px;
}
.card-heading {
  margin-bottom: 18px;
}
.card-heading h3 {
  margin: 0 0 5px;
  font-size: 16px;
}
.card-heading p {
  margin: 0;
  color: var(--text-mute);
  font-size: 13px;
  line-height: 1.5;
}
.top-five-slots {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.top-five-slot {
  min-width: 0;
  min-height: 188px;
  padding: 11px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  background: rgba(11, 13, 18, 0.28);
}
.top-five-slot.occupied {
  border-style: solid;
}
.slot-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 9px;
}
.slot-rank {
  color: var(--amber);
  font-size: 12px;
  font-weight: 800;
}
.slot-label {
  color: var(--text-mute);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.selected-media {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 8px;
}
.selected-poster {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 7px;
  object-fit: cover;
  background: var(--navy);
}
.poster-placeholder,
.result-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-mute);
}
.selected-details {
  min-width: 0;
}
.selected-details strong {
  display: block;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-details span {
  color: var(--text-mute);
  font-size: 10px;
  text-transform: capitalize;
}
.rank-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  color: var(--text-mute);
  font-size: 10px;
}
.rank-control select {
  min-width: 42px;
  padding: 3px 4px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg);
  color: var(--text);
  font-size: 10px;
}
.slot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
}
.empty-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 112px;
  color: var(--text-mute);
  font-size: 11px;
  text-align: center;
}
.text-button {
  padding: 0;
  border: 0;
  background: none;
  color: var(--blue);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.text-button:hover {
  text-decoration: underline;
}
.danger-text {
  color: #f27272;
}
.media-search {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}
.media-search > label {
  display: block;
  margin-bottom: 7px;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 600;
}
.media-search > input {
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
.media-search > input:focus {
  outline: none;
  border-color: var(--blue);
}
.media-search > input:focus-visible,
.search-result:focus-visible,
.text-button:focus-visible,
.btn:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.search-help,
.state-message {
  margin: 9px 0 0;
  color: var(--text-mute);
  font-size: 12px;
}
.search-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  margin-top: 10px;
  overflow-y: auto;
}
.search-result {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.search-result:hover {
  border-color: var(--blue);
}
.search-result:disabled {
  opacity: 0.6;
  cursor: wait;
}
.search-result img,
.result-placeholder {
  width: 34px;
  height: 48px;
  flex: 0 0 34px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--navy);
}
.result-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 3px;
}
.result-details strong {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-details small {
  color: var(--text-mute);
  font-size: 10px;
  text-transform: capitalize;
}
.result-action {
  color: var(--blue);
  font-size: 11px;
  font-weight: 700;
}
.error,
.success {
  margin: 12px 0 0;
  font-size: 12.5px;
}
.error {
  color: #f27272;
}
.success {
  color: #3ecf8e;
}
.save-button {
  margin-top: 16px;
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
@media (max-width: 920px) {
  .top-five-slots {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .top-five-slots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 360px) {
  .top-five-slots {
    grid-template-columns: 1fr;
  }
}
</style>
