<script setup>
import { computed } from "vue";

const props = defineProps({
  data: {
    type: Array,
    default: () => [],
  },
});

const GENRE_ABBREVIATIONS = {
  "Science Fiction": "Sci-Fi",
  "Action & Adventure": "Action",
  "Sci-Fi & Fantasy": "Sci-Fi",
  Animation: "Anim.",
  Documentary: "Docu.",
  "War & Politics": "War",
  Talk: "Talk",
  Mystery: "Mystery",
  "TV Movie": "TV Movie",
};

function abbreviate(genre) {
  return GENRE_ABBREVIATIONS[genre] || genre;
}

const size = 300;
const center = size / 2;
const maxRadius = 82;
const labelRadius = 108;

const maxCount = computed(() => {
  if (!props.data?.length) return 1;
  return Math.max(...props.data.map((d) => d.count), 1);
});

const points = computed(() => {
  if (!props.data?.length) return [];

  const angleStep = (2 * Math.PI) / props.data.length;

  return props.data.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const radius = (d.count / maxCount.value) * maxRadius;

    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);

    const labelX = center + labelRadius * Math.cos(angle);
    const labelY = center + labelRadius * Math.sin(angle);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let anchor = "middle";

    if (cos > 0.35) anchor = "start";
    if (cos < -0.35) anchor = "end";

    return {
      x,
      y,
      labelX,
      labelY,
      genre: abbreviate(d.genre),
      count: d.count,
      anchor,
      angle,
      sin,
    };
  });
});

const polygonPoints = computed(() =>
  points.value.map((p) => `${p.x},${p.y}`).join(" "),
);

const gridLevels = [0.25, 0.5, 0.75, 1];

function gridPolygon(fraction) {
  if (!props.data?.length) return "";

  const angleStep = (2 * Math.PI) / props.data.length;

  return props.data
    .map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const radius = maxRadius * fraction;

      return `${center + radius * Math.cos(angle)},${
        center + radius * Math.sin(angle)
      }`;
    })
    .join(" ");
}
</script>

<template>
  <div class="genre-radar">
    <div class="radar-header">
      <div class="title-wrapper">
        <span class="bar"></span>

        <div>
          <h3>Top Genres</h3>
        </div>
      </div>
    </div>

    <div v-if="!data || data.length === 0" class="empty-state">
      <div class="empty-icon">✦</div>
      <span>Not enough reviews yet to show genre preferences.</span>
    </div>

    <div v-else class="radar-container">
      <svg
        :viewBox="`0 0 ${size} ${size}`"
        class="radar-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <!-- Grid -->
        <polygon
          v-for="level in gridLevels"
          :key="level"
          :points="gridPolygon(level)"
          class="grid-ring"
          :class="{ 'outer-ring': level === 1 }"
        />

        <!-- Axis lines -->
        <line
          v-for="(p, i) in points"
          :key="'axis-' + i"
          :x1="center"
          :y1="center"
          :x2="
            center +
            maxRadius *
              Math.cos(i * ((2 * Math.PI) / points.length) - Math.PI / 2)
          "
          :y2="
            center +
            maxRadius *
              Math.sin(i * ((2 * Math.PI) / points.length) - Math.PI / 2)
          "
          class="axis-line"
        />

        <!-- Data area -->
        <polygon :points="polygonPoints" class="data-shape" />

        <polygon :points="polygonPoints" class="data-outline" />

        <!-- Points -->
        <g v-for="(p, i) in points" :key="'point-' + i">
          <circle :cx="p.x" :cy="p.y" r="7" class="data-point-glow" />

          <circle :cx="p.x" :cy="p.y" r="4" class="data-point" />
        </g>

        <!-- Labels -->
        <g v-for="(p, i) in points" :key="'label-' + i">
          <text
            :x="p.labelX"
            :y="p.labelY"
            class="genre-label"
            :text-anchor="p.anchor"
            dominant-baseline="middle"
          >
            {{ p.genre }}
          </text>

          <text
            :x="p.labelX"
            :y="p.labelY + 16"
            class="genre-count"
            :text-anchor="p.anchor"
            dominant-baseline="middle"
          >
            {{ p.count }} reviews
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.genre-radar {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 20px 18px;
  min-height: 320px;
  display: flex;
  flex-direction: column;
}

/* Header */

.radar-header {
  width: 100%;
}

.title-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.bar {
  width: 3px;
  height: 30px;
  margin-top: 1px;
  background: var(--blue);
  border-radius: 3px;
  flex-shrink: 0;
}

.title-wrapper h3 {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  line-height: 18px;
}

.subtitle {
  display: block;
  margin-top: 3px;
  color: var(--text-mute);
  font-size: 11px;
  font-weight: 500;
}

/* Radar */

.radar-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 0 0;
}

.radar-svg {
  width: 100%;
  max-width: 285px;
  height: auto;
  overflow: visible;
}

/* Grid */

.grid-ring {
  fill: none;
  stroke: rgba(255, 255, 255, 0.045);
  stroke-width: 1;
}

.grid-ring.outer-ring {
  stroke: rgba(255, 255, 255, 0.08);
}

.axis-line {
  stroke: rgba(255, 255, 255, 0.055);
  stroke-width: 1;
}

/* Data */

.data-shape {
  fill: rgba(47, 91, 255, 0.16);
  stroke: none;
}

.data-outline {
  fill: none;
  stroke: var(--blue);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

/* Points */

.data-point-glow {
  fill: var(--blue);
  opacity: 0.12;
}

.data-point {
  fill: var(--bg-card);
  stroke: var(--blue);
  stroke-width: 2;
}

/* Labels */

.genre-label {
  fill: var(--text-dim);
  font-size: 11px;
  font-weight: 600;
}

.genre-count {
  fill: var(--text-mute);
  font-size: 9px;
  font-weight: 500;
}

/* Empty state */

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--text-mute);
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}

.empty-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(47, 91, 255, 0.08);
  color: var(--blue);
  font-size: 16px;
}
</style>
