import { pools } from "../config/db.js";

export async function getTopFiveByUser(userId) {
  const result = await pools.query(
    `SELECT t.rank, m.id AS media_id, m.external_id, m.title, m.poster_url, m.type
     FROM top_five t JOIN media m ON m.id = t.media_id
     WHERE t.user_id = $1
     ORDER BY t.rank ASC`,
    [userId],
  );
  return result.rows;
}

// Substitui o top 5 inteiro numa única transação —
// evita conflitos temporários com a constraint UNIQUE(user_id, rank)
export async function setTopFive(userId, items) {
  // items: [{ mediaId, rank }, ...] até 5
  const client = await pools.connect();
  try {
    await client.query("BEGIN");
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
