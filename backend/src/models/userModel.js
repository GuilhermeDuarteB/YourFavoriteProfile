import { pools } from "../config/db.js";

//create user func
export async function createUser({ username, email, passwordHash }) {
  const result = await pools.query(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at",
    [username, email, passwordHash],
  );
  return result.rows[0];
}

//find user email func

export async function findUserByEmail(email) {
  const result = await pools.query("SELECT * from users WHERE email = $1", [
    email,
  ]);
  return result.rows[0];
}

//find user ID func
export async function findUserById(id, withPassword = false) {
  const columns = withPassword
    ? "id, username, email, password_hash, bio, avatar_url, created_at"
    : "id, username, bio, email, avatar_url, created_at";

  const result = await pools.query(
    `SELECT ${columns} FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0];
}

export async function findUserByUsername(username) {
  const result = await pools.query(
    `SELECT id, username, email, bio, avatar_url, created_at
     FROM users WHERE username = $1`,
    [username],
  );
  return result.rows[0];
}

export async function searchUsersByUsername(query) {
  const result = await pools.query(
    `SELECT id, username, avatar_url FROM users
     WHERE username ILIKE $1
     LIMIT 20`,
    [`%${query}%`],
  );
  return result.rows;
}

//user stats

export async function getUserStats(userId) {
  const result = await pools.query(
    `SELECT COUNT(*) AS review_count, AVG(score) AS avg_score FROM reviews
    WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    reviewCount: Number(row.review_count),
    avgScore: row.avg_score ? Number(Number(row.avg_score).toFixed(1)) : null,
  };
}

export async function updateUserProfile(userId, { bio, avatarUrl }) {
  const result = await pools.query(
    `UPDATE users SET bio = $1, avatar_url = $2 WHERE id = $3 RETURNING id,username,email,bio,avatar_url,created_at`,
    [bio, avatarUrl, userId],
  );
  return result.rows[0];
}

//update user email

export async function updateUserEmail(userId, newEmail) {
  const result = await pools.query(
    `UPDATE users SET email = $1 WHERE id = $2 
    RETURNING id, username,email`[(newEmail, userId)],
  );
  return result.rows[0];
}

//delete user

export async function deleteUser(id) {
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
}
