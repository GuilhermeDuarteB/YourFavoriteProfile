import { containsBlockedUsername } from "./moderation.js";

export function planUsernameRenames(users) {
  const reserved = new Set(users.map((user) => user.username.toLowerCase()));
  return [...users]
    .sort((a, b) => a.id - b.id)
    .filter((user) => containsBlockedUsername(user.username))
    .map(({ id }) => {
      const base = `user${id}`;
      let username = base;
      let suffix = 1;
      while (reserved.has(username.toLowerCase())) {
        username = `${base}_${suffix++}`;
      }
      reserved.add(username.toLowerCase());
      return { id, username };
    });
}

export async function moderateUsernames(pool, { apply = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
    if (apply) {
      await client.query("SET LOCAL lock_timeout = '5s'");
      // Serialize username writes, including registrations, while planning and
      // updating. Reads remain available; no identity or relationship changes.
      await client.query("LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE");
    }
    const { rows } = await client.query(
      "SELECT id, username FROM public.users ORDER BY id",
    );
    const plan = planUsernameRenames(rows);
    if (apply) {
      for (const { id, username } of plan) {
        const result = await client.query(
          "UPDATE public.users SET username = $1 WHERE id = $2",
          [username, id],
        );
        if (result.rowCount !== 1) {
          throw new Error("Account changed during username maintenance");
        }
      }
    }
    await client.query("COMMIT");
    return plan;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
