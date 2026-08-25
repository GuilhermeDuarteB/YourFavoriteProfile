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
