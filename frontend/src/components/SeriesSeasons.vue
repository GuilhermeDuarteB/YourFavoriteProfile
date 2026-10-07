<script setup>
import { reactive } from "vue";
import api from "../api/axios.js";
import EpisodeReviews from "./EpisodeReviews.vue";

const props = defineProps({
  seriesId: [String, Number],
  seasons: { type: Array, default: () => [] },
});
const emit = defineEmits(["changed"]);
const seasonStates = reactive({});

async function loadSeason(seasonNumber) {
  const state = (seasonStates[seasonNumber] ||= {
    expanded: false,
    loading: false,
    error: "",
    data: null,
  });
  if (state.loading || state.data) return;
  state.loading = true;
  state.error = "";
  try {
    const res = await api.get(
      `/media/series/${props.seriesId}/season/${seasonNumber}`,
    );
    state.data = res.data;
  } catch (err) {
    state.error = err.response?.data?.error || "Unable to load this season.";
  } finally {
    state.loading = false;
  }
}

async function toggleSeason(seasonNumber) {
  const state = (seasonStates[seasonNumber] ||= {
    expanded: false,
    loading: false,
    error: "",
    data: null,
  });
  state.expanded = !state.expanded;
  if (state.expanded) await loadSeason(seasonNumber);
}

function formatAirDate(date) {
  if (!date) return "Air date unavailable";
  return new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <section class="series-seasons">
    <h3>Seasons and episode reviews</h3>
    <p>
      Review individual episodes. The series community score averages the
      ratings of its reviewed episodes.
    </p>
    <p v-if="!seasons.length">No seasons available yet.</p>
    <div v-for="season in seasons" :key="season.seasonNumber" class="season">
      <button
        class="season-toggle"
        type="button"
        :aria-expanded="!!seasonStates[season.seasonNumber]?.expanded"
        :aria-controls="`season-${season.seasonNumber}`"
        @click="toggleSeason(season.seasonNumber)"
      >
        <strong>{{ season.name }}</strong>
        <span
          >{{ season.episodeCount }}
          {{ season.episodeCount === 1 ? "episode" : "episodes" }}
          <span aria-hidden="true">{{
            seasonStates[season.seasonNumber]?.expanded ? "−" : "+"
          }}</span></span
        >
      </button>
      <div
        v-show="seasonStates[season.seasonNumber]?.expanded"
        :id="`season-${season.seasonNumber}`"
        class="season-content"
      >
        <p v-if="seasonStates[season.seasonNumber]?.loading" role="status">
          Loading episodes...
        </p>
        <p v-else-if="seasonStates[season.seasonNumber]?.error" role="alert">
          {{ seasonStates[season.seasonNumber].error }}
          <button
            type="button"
            class="retry"
            @click="loadSeason(season.seasonNumber)"
          >
            Retry
          </button>
        </p>
        <template v-if="seasonStates[season.seasonNumber]?.data">
          <p v-if="!seasonStates[season.seasonNumber].data.episodes.length">
            No episodes available.
          </p>
          <article
            v-for="episode in seasonStates[season.seasonNumber].data.episodes"
            :key="episode.episodeId"
            class="episode"
          >
            <img
              v-if="episode.stillUrl"
              :src="episode.stillUrl"
              alt=""
              loading="lazy"
              class="episode-still"
            />
            <div class="episode-info">
              <h4>
                E{{ String(episode.episodeNumber).padStart(2, "0") }} ·
                {{ episode.title }}
              </h4>
              <p class="air-date">{{ formatAirDate(episode.airDate) }}</p>
              <p v-if="episode.overview" class="episode-overview">
                {{ episode.overview }}
              </p>
              <EpisodeReviews :episode="episode" @changed="emit('changed')" />
            </div>
          </article>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
h3 {
  margin: 0 0 12px;
  font-size: 16px;
}
p {
  color: var(--text-dim);
  line-height: 1.5;
  font-size: 13px;
}
.season {
  margin-top: 10px;
  border: 1px solid var(--border, #293041);
  border-radius: 10px;
  background: var(--bg-card);
}
.season-toggle {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.season-toggle span {
  font-size: 12px;
  color: var(--text-dim);
}
.season-toggle:focus-visible,
.retry:focus-visible {
  outline: 2px solid var(--blue);
  outline-offset: 2px;
}
.season-content {
  padding: 0 16px 16px;
}
.episode {
  display: flex;
  gap: 16px;
  padding: 18px 0;
  border-top: 1px solid var(--border, #293041);
}
.episode-still {
  width: 140px;
  height: 79px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
}
.episode-info {
  flex: 1;
  min-width: 0;
}
h4 {
  margin: 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.air-date {
  font-size: 11px;
  margin: 6px 0;
}
.episode-overview {
  margin: 8px 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.retry {
  padding: 6px 10px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
}
[role="alert"] {
  color: #f27272;
}
@media (max-width: 600px) {
  .episode {
    flex-direction: column;
  }
  .episode-still {
    width: 100%;
    height: auto;
    aspect-ratio: 16/9;
  }
  .season-toggle {
    flex-wrap: wrap;
  }
}
</style>
