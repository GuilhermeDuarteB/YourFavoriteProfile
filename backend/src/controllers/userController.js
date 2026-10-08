import {
  findUserByUsername,
  searchUsersByUsername,
  getUserStats,
  updateUserProfile,
} from "../models/userModel.js";
import {
  getReviewsByUser,
  getGenreBreakdown,
  getUserReviewPage,
} from "../models/reviewModel.js";
import { getFollowCounts, isFollowing } from "../models/followModel.js";
import { getTopFiveByUser } from "../models/topFiveModel.js";

export async function getPublicProfile(req, res) {
  try {
    const user = await findUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const followCounts = await getFollowCounts(user.id);
    const viewerFollows = req.userId
      ? await isFollowing(req.userId, user.id)
      : false;

    const [stats, recentReviews, genreBreakdown, topFive] = await Promise.all([
      getUserStats(user.id),
      getReviewsByUser(user.id),
      getGenreBreakdown(user.id),
      getTopFiveByUser(user.id),
    ]);

    res.json({
      id: user.id,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      stats,
      recentReviews,
      genreBreakdown,
      followCounts,
      viewerFollows,
      topFive,
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

export async function getUserReviews(req, res) {
  const {
    type,
    genre,
    minScore,
    sort = "newest",
    page = "1",
    pageSize = "20",
  } = req.query;
  const positiveInteger = (value) =>
    typeof value === "string" &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;
  if (
    (type !== undefined && !["movie", "series", "game"].includes(type)) ||
    (genre !== undefined &&
      (typeof genre !== "string" || !genre.trim() || genre.length > 100)) ||
    (minScore !== undefined &&
      (typeof minScore !== "string" ||
        !minScore.trim() ||
        !Number.isFinite(Number(minScore)) ||
        Number(minScore) < 0 ||
        Number(minScore) > 10)) ||
    !["newest", "oldest", "highest", "lowest"].includes(sort) ||
    !positiveInteger(page) ||
    !positiveInteger(pageSize) ||
    Number(pageSize) > 100 ||
    !Number.isSafeInteger((Number(page) - 1) * Number(pageSize))
  ) {
    return res
      .status(400)
      .json({ error: "Invalid review filters or pagination" });
  }
  try {
    const user = await findUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await getUserReviewPage(user.id, {
      type,
      genre: genre?.trim(),
      minScore: minScore === undefined ? undefined : Number(minScore),
      sort,
      page: Number(page),
      pageSize: Number(pageSize),
    });
    res.json({ username: user.username, ...result });
  } catch (err) {
    console.error("User reviews failed:", err.message);
    res.status(500).json({ error: "Error loading user reviews" });
  }
}
