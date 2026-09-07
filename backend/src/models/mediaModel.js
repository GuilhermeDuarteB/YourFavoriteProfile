import { pools } from "../config/db.js";

export async function findOrCreateMedia({
  externalId,
  source,
  type,
  title,
  posterUrl,
  releaseDate,
  genres,
}) {
  const existing = await pools.query(
    "SELECT * FROM media WHERE external_id = $1 AND source = $2",
    [externalId, source],
  );

  if (existing.rows[0]) {
    const hasGenres =
      existing.rows[0].genres && existing.rows[0].genres.length > 0;
    if (!hasGenres && genres?.length) {
      const updated = await pools.query(
        `UPDATE media SET genres = $1 WHERE id = $2 RETURNING *`,
        [genres, existing.rows[0].id],
      );
      return updated.rows[0];
    }
    return existing.rows[0];
  }

  const result = await pools.query(
    `INSERT INTO media (external_id, source, type, title, poster_url, release_date, genres)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [externalId, source, type, title, posterUrl, releaseDate, genres || []],
  );

  return result.rows[0];
}
