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
  const score = result.rows[0]?.avg_score;
  return score == null ? null : Number(score);
}

//series score

export async function getSeriesMedia(mediaId) {
  const result = await pools.query(
    `SELECT series_score FROM vw_series_rating WHERE media_id = $1`,
    [mediaId],
  );
  const score = result.rows[0]?.series_score;
  return score == null ? null : Number(score);
}

//reviews by user

export async function getReviewsByUser(userId, limit = 6) {
  const result = await pools.query(
    `SELECT r.id, r.score, r.comment, r.created_at, m.title, m.poster_url, m.type,
      r.episode_id, ep.title AS episode_title, se.season_number, ep.episode_number
    FROM reviews r
    LEFT JOIN episodes ep ON ep.id = r.episode_id
    LEFT JOIN seasons se ON se.id = ep.season_id
    JOIN media m ON m.id = COALESCE(r.media_id, se.media_id)
    WHERE r.user_id = $1
    ORDER BY r.created_at DESC
    LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export async function getUserReviewPage(
  userId,
  { type, genre, minScore, sort = "newest", page = 1, pageSize = 20 },
) {
  const ordering = {
    newest: '"createdAt" DESC, id DESC',
    oldest: '"createdAt" ASC, id ASC',
    highest: 'score DESC, "createdAt" DESC, id DESC',
    lowest: 'score ASC, "createdAt" DESC, id DESC',
  };
  const result = await pools.query(
    `WITH user_reviews AS (
      SELECT r.id, r.score::float8 AS score, r.comment, r.created_at AS "createdAt",
        m.id AS "mediaId", m.external_id AS "externalId", m.type AS "mediaType",
        m.title AS "mediaTitle", m.poster_url AS "posterUrl", COALESCE(m.genres, ARRAY[]::text[]) AS genres,
        r.episode_id AS "episodeId", ep.title AS "episodeTitle",
        ep.episode_number AS "episodeNumber", se.season_number AS "seasonNumber"
      FROM reviews r
      LEFT JOIN episodes ep ON ep.id = r.episode_id
      LEFT JOIN seasons se ON se.id = ep.season_id
      JOIN media m ON m.id = COALESCE(r.media_id, se.media_id)
      WHERE r.user_id = $1
    ), filtered_reviews AS (
      SELECT * FROM user_reviews
      WHERE ($2::text IS NULL OR "mediaType" = $2)
        AND ($3::text IS NULL OR $3 = ANY(genres))
        AND ($4::float8 IS NULL OR score >= $4)
    )
    SELECT (SELECT COUNT(*) FROM user_reviews) AS "totalUserReviews",
      (SELECT COUNT(*) FROM filtered_reviews) AS total,
      COALESCE((SELECT json_agg(review_page) FROM (
        SELECT * FROM filtered_reviews ORDER BY ${ordering[sort] || ordering.newest} LIMIT $5 OFFSET $6
      ) review_page), '[]'::json) AS reviews,
      COALESCE((SELECT json_agg(genre ORDER BY genre) FROM (
        SELECT DISTINCT unnest(genres) AS genre FROM user_reviews
      ) genre_options WHERE genre IS NOT NULL AND genre <> ''), '[]'::json) AS "availableGenres"`,
    [
      userId,
      type || null,
      genre || null,
      minScore ?? null,
      pageSize,
      (page - 1) * pageSize,
    ],
  );
  const row = result.rows[0];
  const total = Number(row.total);
  return {
    reviews: row.reviews,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    totalUserReviews: Number(row.totalUserReviews),
    availableGenres: row.availableGenres,
  };
}

//existent review

export async function findExistingReview({ userId, mediaId, episodeId }) {
  const result = await pools.query(
    `SELECT * FROM reviews WHERE user_id = $1 AND media_id IS NOT DISTINCT FROM $2 AND episode_id IS NOT DISTINCT FROM $3`,
    [userId, mediaId || null, episodeId || null],
  );
  return result.rows[0];
}

//genre breakdown for profile radar chart

export async function getGenreBreakdown(userId) {
  const result = await pools.query(
    `SELECT unnest(m.genres) AS genre, COUNT(*) AS count
     FROM reviews r
     LEFT JOIN episodes ep ON ep.id = r.episode_id
     LEFT JOIN seasons se ON se.id = ep.season_id
     JOIN media m ON m.id = COALESCE(r.media_id, se.media_id)
     WHERE r.user_id = $1 AND m.genres IS NOT NULL
     GROUP BY genre
     ORDER BY count DESC
     LIMIT 5`,
    [userId],
  );
  return result.rows.map((row) => ({
    genre: row.genre,
    count: Number(row.count),
  }));
}
