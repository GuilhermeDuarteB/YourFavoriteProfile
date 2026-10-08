import { pools } from "../config/db.js";

export async function followUser(followerId, followingId) {
  const result = await pools.query(
    `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
     ON CONFLICT (follower_id, following_id) DO NOTHING
     RETURNING *`,
    [followerId, followingId],
  );
  return result.rows[0];
}

export async function unfollowUser(followerId, followingId) {
  const result = await pools.query(
    `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId],
  );
}

export async function isFollowing(followerId, followingId) {
  const result = await pools.query(
    `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId],
  );
  return result.rows.length > 0;
}

export async function getFollowCounts(userId) {
  const result = await pools.query(
    `SELECT
       (SELECT COUNT(*) FROM follows WHERE following_id = $1) AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id = $1) AS following`,
    [userId],
  );
  return {
    followers: Number(result.rows[0].followers),
    following: Number(result.rows[0].following),
  };
}

export async function getFollowList(userId, direction, page, pageSize) {
  // The identifiers come only from this fixed mapping, never from user input.
  const columns = {
    followers: { owner: "following_id", member: "follower_id" },
    following: { owner: "follower_id", member: "following_id" },
  }[direction];
  if (!columns) throw new Error("Invalid follow list direction");

  const [count, result] = await Promise.all([
    pools.query(
      `SELECT COUNT(*) AS total FROM follows WHERE ${columns.owner} = $1`,
      [userId],
    ),
    pools.query(
      `SELECT u.id, u.username, u.avatar_url AS "avatarUrl"
       FROM follows f JOIN users u ON u.id = f.${columns.member}
       WHERE f.${columns.owner} = $1
       ORDER BY LOWER(u.username), u.id LIMIT $2 OFFSET $3`,
      [userId, pageSize, (page - 1) * pageSize],
    ),
  ]);
  return { users: result.rows, total: Number(count.rows[0].total) };
}
