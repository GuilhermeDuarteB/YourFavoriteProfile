import {
  createReview,
  getReviewsByMedia,
  getReviewsByEpisode,
  findReviewById,
  deleteReview,
  updateReview,
} from "../models/reviewModel.js";

export async function postReview(req, res) {
  try {
    const { mediaId, episodeId, score, comment } = req.body;
    const userId = req.userId; //authMiddleware

    if (!mediaId && !episodeId) {
      return res
        .status(400)
        .json({ error: "mediaId or episodeId is required" });
    }
    if (mediaId && episodeId) {
      return res
        .status(400)
        .json({ error: "Provide either mediaId or episodeId, not both" });
    }
    if (score === undefined || score < 0 || score > 10) {
      return res.status(400).json({ error: "Score must be between 0 and 10" });
    }

    const review = await createReview({
      userId,
      mediaId,
      episodeId,
      score,
      comment,
    });
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
    res.status(500).json({ error: "Error loading review" });
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
    const reviews = await findReviewById(req.params.id);
    if (!reviews) return res.status(404).json({ error: "Review not found" });
    if (reviews.user_id !== req.userId) {
      return res
        .status(403)
        .json({ error: "You can only edit your own reviews" });
    }

    const { score, comment } = req.body;
    const updated = await updateReview(req.params.id, { score, comment });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating Review" });
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
    res.status(500).json({ error: "Errpr deleting review" });
  }
}
