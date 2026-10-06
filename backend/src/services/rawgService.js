import axios from "axios";

const rawg = axios.create({
  baseURL: "https://api.rawg.io/api",
  timeout: 5000,
  params: {
    key: process.env.RAWG_API_KEY,
  },
});

export async function searchRawg(query, genre = "all") {
  const params = { search: query };
  if (Object.hasOwn(RAWG_GENRE_SLUGS, genre)) params.genres = RAWG_GENRE_SLUGS[genre];
  const res = await rawg.get("/games", {
    params,
  });
  return res.data.results;
}

export async function getTrendingRawg() {
  const res = await rawg.get("/games", {
    params: {
      ordering: "-added",
    },
  });
  return res.data.results;
}

//slug to dont coincide with tmbd
export const RAWG_GENRE_SLUGS = {
  action: "action",
  adventure: "adventure",
  indie: "indie",
  rpg: "role-playing-games-rpg",
  strategy: "strategy",
  shooter: "shooter",
  casual: "casual",
  simulation: "simulation",
  puzzle: "puzzle",
  arcade: "arcade",
  racing: "racing",
  sports: "sports",
};

function mapRawgSort(sortBy) {
  switch (sortBy) {
    case "rating":
      return "-rating";
    case "release_date":
      return "-released";
    case "title":
      return "name";
    default:
      return "-added"; //popularity proxy
  }
}

export async function discoverGames({
  genre,
  decade,
  minRating,
  sortBy,
  page,
  pageSize,
}) {
  const params = {
    dates:
      decade && decade !== "all"
        ? `${decade}-01-01,${Number(decade) + 9}-12-31`
        : undefined,
    ordering: mapRawgSort(sortBy),
    page,
    page_size: pageSize,
  };
  // Themes such as drama, comedy, sci-fi and horror have no shared genre mapping.
  if (Object.hasOwn(RAWG_GENRE_SLUGS, genre)) params.genres = RAWG_GENRE_SLUGS[genre];
  const res = await rawg.get("/games", { params });
  const filtered = minRating
    ? res.data.results.filter((g) => g.rating != null && g.rating * 2 >= minRating)
    : res.data.results;
  return { results: filtered, hasMore: !!res.data.next };
}

export async function getGameDetails(id) {
  const res = await rawg.get(`/games/${id}`);
  return res.data;
}
