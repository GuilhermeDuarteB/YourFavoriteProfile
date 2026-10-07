import { validateReview } from "../utils/validation.js";
import { findMediaById, findEpisodeById } from "../models/mediaModel.js";
import {
  createReview,
  getReviewsByMedia,
  getReviewsByEpisode,
  findReviewById,
  deleteReview,
  updateReview,
  findExistingReview,
} from "../models/reviewModel.js";
import {
  addToWatchlist,
  findWatchlistEntry,
} from "../models/watchlistModel.js";

export async function postReview(req, res) {
  try {
    const { mediaId, episodeId, score, comment } = req.body || {};
    const userId = req.userId;

    const hasMedia = mediaId != null;
    const hasEpisode = episodeId != null;
    if (!hasMedia && !hasEpisode) {
      return res
        .status(400)
        .json({ error: "mediaId or episodeId is required" });
    }
    if (hasMedia && hasEpisode) {
      return res
        .status(400)
        .json({ error: "Provide either mediaId or episodeId, not both" });
    }
    const validationError = validateReview(score, comment);
    if (validationError) return res.status(400).json({ error: validationError });

    const targetId = hasMedia ? mediaId : episodeId;
    if (!["number", "string"].includes(typeof targetId) || !/^\d+$/.test(String(targetId)) || !Number.isSafeInteger(Number(targetId)) || Number(targetId) <= 0) {
      return res.status(400).json({ error: "Media or episode ID must be a positive integer" });
    }
    if (mediaId) {
      const media = await findMediaById(mediaId);
      if (!media) return res.status(404).json({ error: "Media not found" });
      if (media.type === "series") {
        return res.status(400).json({ error: "Series must be reviewed by episode" });
      }
      if (!["movie", "game"].includes(media.type)) {
        return res.status(400).json({ error: "Only movies and games support direct reviews" });
      }
    } else {
      const episode = await findEpisodeById(episodeId);
      if (!episode) return res.status(404).json({ error: "Episode not found" });
    }

    const existing = await findExistingReview({ userId, mediaId, episodeId });
    if (existing) {
      return res.status(409).json({
        error: "You already reviewed this — edit your existing review instead.",
      });
    }

    const review = await createReview({
      userId,
      mediaId,
      episodeId,
      score,
      comment,
    });

    if (mediaId) {
      const existingEntry = await findWatchlistEntry(userId, mediaId);
      if (existingEntry && existingEntry.status !== "completed") {
        await addToWatchlist(userId, mediaId, "completed");
      }
    }

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating review" });
  }
}

export async function getMediaReviews(req, res) {
  try {
    const reviews = await getReviewsByMedia(req.params.mediaId);
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error loading reviews" });
  }
}

export async function getEpisodeReviews(req, res) {
  try {
    const reviews = await getReviewsByEpisode(req.params.episodeId);
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error loading reviews" });
  }
}

export async function putReview(req, res) {
  try {
    const { score, comment } = req.body || {};
    const validationError = validateReview(score, comment);
    if (validationError) return res.status(400).json({ error: validationError });
    const reviews = await findReviewById(req.params.id);
    if (!reviews) return res.status(404).json({ error: "Review not found" });
    if (reviews.user_id !== req.userId) {
      return res
        .status(403)
        .json({ error: "You can only edit your own reviews" });
    }

    const updated = await updateReview(req.params.id, { score, comment: comment ?? null });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating review" });
  }
}

export async function removeReview(req, res) {
  try {
    const review = await findReviewById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.user_id !== req.userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own reviews" });
    }

    await deleteReview(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting review" });
  }
}
