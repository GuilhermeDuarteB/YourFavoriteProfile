import { Router } from "express";
import {
  postReview,
  getMediaReviews,
  getEpisodeReviews,
  putReview,
  removeReview,
} from "../controllers/reviewController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.post("/", authMiddleware, postReview);
router.get("/media/:mediaId", getMediaReviews);
router.get("/episode/:episodeId", getEpisodeReviews);
router.put("/:id", authMiddleware, putReview);
router.delete("/:id", authMiddleware, removeReview);

export default router;
