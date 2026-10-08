import { pools } from "../config/db.js";
import { isBlockedMedia } from "../utils/moderation.js";

export async function getTopFiveByUser(userId) {
  const result = await pools.query(
    `SELECT t.rank, m.id AS media_id, m.external_id, m.title, m.poster_url, m.type
     FROM top_five t JOIN media m ON m.id = t.media_id
     WHERE t.user_id = $1
     ORDER BY t.rank ASC`,
    [userId],
  );
  return result.rows.filter((media) => !isBlockedMedia(media));
}

// Substitui o top 5 inteiro numa única transação —
// evita conflitos temporários com a constraint UNIQUE(user_id, rank)
export async function setTopFive(userId, items) {
  // items: [{ mediaId, rank }, ...] até 5
  const client = await pools.connect();
  try {
    await client.query("BEGIN");
    // Hidden favorites remain stored. A replacement must not silently delete them.
    const existing = await client.query(
      `SELECT m.title FROM top_five t JOIN media m ON m.id = t.media_id
       WHERE t.user_id = $1 FOR UPDATE OF t`,
      [userId],
    );
    if (existing.rows.some(isBlockedMedia)) {
      const error = new Error("Your Top 5 contains unavailable media. Contact support before replacing it; your favorites have been preserved.");
      error.code = "TOP_FIVE_UNAVAILABLE";
      throw error;
    }
    const selected = await client.query(
      "SELECT id, title FROM media WHERE id = ANY($1::int[])",
      [items.map((item) => item.mediaId)],
    );
    if (selected.rows.some(isBlockedMedia)) {
      const error = new Error("One or more selected media items are unavailable");
      error.code = "MEDIA_UNAVAILABLE";
      throw error;
    }
    await client.query("DELETE FROM top_five WHERE user_id = $1", [userId]);

    for (const item of items) {
      await client.query(
        `INSERT INTO top_five (user_id, media_id, rank) VALUES ($1, $2, $3)`,
        [userId, item.mediaId, item.rank],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
