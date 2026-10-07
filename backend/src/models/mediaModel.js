import { pools } from "../config/db.js";

export async function findMediaById(mediaId) {
  const result = await pools.query("SELECT * FROM media WHERE id = $1", [
    mediaId,
  ]);
  return result.rows[0];
}

export async function findEpisodeById(episodeId) {
  const result = await pools.query("SELECT id FROM episodes WHERE id = $1", [
    episodeId,
  ]);
  return result.rows[0];
}

export async function findOrCreateSeason(mediaId, seasonNumber, title) {
  const existing = await pools.query(
    "SELECT * FROM seasons WHERE media_id = $1 AND season_number = $2",
    [mediaId, seasonNumber],
  );
  if (existing.rows[0]) return existing.rows[0];
  const result = await pools.query(
    `INSERT INTO seasons (media_id, season_number, title) VALUES ($1, $2, $3)
     ON CONFLICT (media_id, season_number) DO UPDATE SET season_number = EXCLUDED.season_number
     RETURNING *`,
    [mediaId, seasonNumber, title],
  );
  return result.rows[0];
}

export async function findOrCreateEpisode(
  seasonId,
  episodeNumber,
  title,
  airDate,
) {
  const existing = await pools.query(
    "SELECT * FROM episodes WHERE season_id = $1 AND episode_number = $2",
    [seasonId, episodeNumber],
  );
  if (existing.rows[0]) return existing.rows[0];
  const result = await pools.query(
    `INSERT INTO episodes (season_id, episode_number, title, air_date) VALUES ($1, $2, $3, $4)
     ON CONFLICT (season_id, episode_number) DO UPDATE SET episode_number = EXCLUDED.episode_number
     RETURNING *`,
    [seasonId, episodeNumber, title, airDate || null],
  );
  return result.rows[0];
}

export async function findOrCreateMedia({
  externalId,
  source,
  type,
  title,
  posterUrl,
  releaseDate,
  genres,
}) {
  // The unique identity serializes concurrent imports and keeps TMDB movie
  // and series IDs distinct. Only fill empty genres; retain existing metadata.
  const result = await pools.query(
    `INSERT INTO media (external_id, source, type, title, poster_url, release_date, genres)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (external_id, source, type) DO UPDATE
     SET genres = CASE
       WHEN COALESCE(cardinality(media.genres), 0) = 0 AND cardinality(EXCLUDED.genres) > 0
       THEN EXCLUDED.genres ELSE media.genres END
     RETURNING *`,
    [externalId, source, type, title, posterUrl, releaseDate, genres || []],
  );

  return result.rows[0];
}
