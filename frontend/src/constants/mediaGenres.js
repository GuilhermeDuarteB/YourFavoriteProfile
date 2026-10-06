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
  return (GENRES_BY_TYPE[types[0]] || [])
    .filter(([value]) => types.every((type) =>
      GENRES_BY_TYPE[type]?.some(([key]) => key === value),
    ))
    .map(([value, label]) => ({ value, label }));
}
