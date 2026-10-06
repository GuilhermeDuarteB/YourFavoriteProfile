import { pools } from "../config/db.js";

export async function addToWatchlist(
  userId,
  mediaId,
  status = "want_to_watch",
) {
  const result = await pools.query(
    `INSERT INTO watchlist (user_id, media_id, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, media_id) DO UPDATE SET status = $3
     RETURNING *`,
    [userId, mediaId, status],
  );
  return result.rows[0];
}

export async function removeFromWatchlist(userId, mediaId) {
  await pools.query(
    `DELETE FROM watchlist WHERE user_id = $1 AND media_id = $2`,
    [userId, mediaId],
  );
}

export async function getWatchlistByUser(userId, status = null) {
  const query = status
    ? `SELECT w.*, m.external_id, m.title, m.poster_url, m.type, m.release_date
       FROM watchlist w JOIN media m ON m.id = w.media_id
       WHERE w.user_id = $1 AND w.status = $2
       ORDER BY w.added_at DESC`
    : `SELECT w.*, m.external_id, m.title, m.poster_url, m.type, m.release_date
       FROM watchlist w JOIN media m ON m.id = w.media_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`;
  const params = status ? [userId, status] : [userId];
  const result = await pools.query(query, params);
  return result.rows;
}

export async function findWatchlistEntry(userId, mediaId) {
  const result = await pools.query(
    `SELECT * FROM watchlist WHERE user_id = $1 AND media_id = $2`,
    [userId, mediaId],
  );
  return result.rows[0];
}
