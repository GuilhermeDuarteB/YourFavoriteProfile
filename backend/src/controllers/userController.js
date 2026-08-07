import {
  findUserByUsername,
  searchUsersByUsername,
  getUserStats,
  updateUserProfile,
} from "../models/userModel.js";
import { getReviewsByUser } from "../models/reviewModel.js";

export async function getPublicProfile(req, res) {
  try {
    const user = await findUserByUsername(req.params.username);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [stats, recentReviews] = await Promise.all([
      getUserStats(user.id),
      getReviewsByUser(user.id),
    ]);

    res.json({
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      stats,
      recentReviews,
      topFive: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error loading profile" });
  }
}

export async function updateMyProfile(req, res) {
  try {
    const { bio, avatarUrl } = req.body;
    const updated = await updateUserProfile(req.userId, { bio, avatarUrl });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating profile" });
  }
}

export async function searchUsers(req, res) {
  try {
    const { q } = req.query;

    if (!q) {
      return res.json([]);
    }

    const users = await searchUsersByUsername(q);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error searching users" });
  }
}
