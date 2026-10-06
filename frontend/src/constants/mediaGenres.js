// Keep game keys aligned with RAWG_GENRE_SLUGS in the backend.
const GAME_GENRES = [
  ["action", "Action"], ["adventure", "Adventure"], ["rpg", "RPG"],
  ["strategy", "Strategy"], ["shooter", "Shooter"], ["puzzle", "Puzzle"],
  ["racing", "Racing"], ["sports", "Sports"], ["simulation", "Simulation"],
  ["indie", "Indie"], ["casual", "Casual"], ["arcade", "Arcade"],
];
const MOVIE_GENRES = [
  ["action", "Action"], ["drama", "Drama"], ["comedy", "Comedy"],
  ["scifi", "Sci-Fi"], ["horror", "Horror"],
];
const GENRES_BY_TYPE = {
  movie: MOVIE_GENRES,
  series: MOVIE_GENRES.filter(([value]) => value !== "horror"),
  game: GAME_GENRES,
};

export function getGenreOptions(types) {
  if (!types.length) return [];

  // A mixed Browse selection is a union of the genres supported by its
  // providers. The backend applies a selected genre only to the providers
  // that can represent it, so a useful option is not lost just because
  // another selected provider has a different taxonomy.
  const selected = new Set(types);
  const seen = new Set();
  return ["movie", "series", "game"]
    .filter((type) => selected.has(type))
    .flatMap((type) => GENRES_BY_TYPE[type] || [])
    .filter(([value]) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .map(([value, label]) => ({ value, label }));
}
