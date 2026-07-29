import { pools } from "../config/db.js";

export async function createReview({
  userId,
  mediaId,
  episodeId,
  score,
  comment,
}) {
  const result = await pools.query(
    `INSERT INTO reviews(user_id, media_id, episode_id, score, comment)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [userId, mediaId || null, episodeId || null, score, comment || null],
  );
  return result.rows[0];
}

export async function getReviewsByMedia(mediaId) {
  const result = await pools.query(
    `SELECT r.*, u.username, u.avatar_url FROM reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.media_id = $1
        ORDER BY r.created_at DESC`,
    [mediaId],
  );
  return result.rows;
}

export async function getReviewsByEpisode(episodeId) {
  const result = await pools.query(
    `SELECT r.*, u.username, u.avatar_url FROM reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.episode_id = $1
        ORDER BY r.created_at DESC`,
    [episodeId],
  );
  return result.rows;
}

export async function findReviewById(id) {
  const result = await pools.query(
    `
        SELECT * FROM reviews WHERE id = $1`,
    [id],
  );

  return result.rows[0];
}

export async function updateReview(id, { score, comment }) {
  const result = await pools.query(
    `UPDATE reviews SET score = $1, comment = $2 WHERE id = $3 RETURNING * `,
    [score, comment, id],
  );
  return result.rows[0];
}

export async function deleteReview(id) {
  await pools.query(`DELETE FROM reviews WHERE id = $1`, [id]);
}

//movie/game score

export async function getMediaRating(mediaId) {
  const result = await pools.query(
    `SELECT avg_score FROM vw_media_rating WHERE media_id = $1`,
    [mediaId],
  );
  return result.rows[0]?.avg_score || null;
}

//series score

export async function getSeriesMedia(mediaId) {
  const result = await pools.query(
    `SELECT series_score FROM vw_series_rating WHERE media_id = $1`,
    [mediaId],
  );
  return result.rows[0]?.series_score || null;
}
