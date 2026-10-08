import { Router } from "express";
import {
  register,
  login,
  getCurrentUser,
  updateEmail,
  updateUsernameHandler,
  deleteAccount,
} from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getCurrentUser);
router.put("/me/email", authMiddleware, updateEmail);
router.put("/me/username", authMiddleware, updateUsernameHandler);
router.delete("/me", authMiddleware, deleteAccount);

export default router;
