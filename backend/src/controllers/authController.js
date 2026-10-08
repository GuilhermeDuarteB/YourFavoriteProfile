import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  normalizeEmail,
  validateUsername,
  validateEmail,
  validatePassword,
} from "../utils/validation.js";
import {
  findUserById,
  updateUserEmail,
  updateUsername,
  deleteUser,
  createUser,
  findUserByEmail,
  findUserByUsername,
} from "../models/userModel.js";

const SALT_ROUNDS = 10;
const isEmailConflict = (err) =>
  err.code === "23505" &&
  ["users_email_normalized_unique", "users_email_key"].includes(err.constraint);
const isUsernameConflict = (err) =>
  err.code === "23505" &&
  ["users_username_lower_unique", "users_username_key"].includes(
    err.constraint,
  );

export async function register(req, res) {
  try {
    const { username, password } = req.body || {};
    const email = normalizeEmail(req.body?.email);
    const validationError =
      validateUsername(username) ||
      validateEmail(email) ||
      validatePassword(password);
    if (validationError)
      return res.status(400).json({ error: validationError });

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const existingUsername = await findUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ error: "Username already in use" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createUser({ username, email, passwordHash });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({ user, token });
  } catch (err) {
    if (isEmailConflict(err))
      return res.status(409).json({ error: "Email already in use" });
    if (isUsernameConflict(err))
      return res.status(409).json({ error: "Username already in use" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body || {};

    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      console.warn("[AUTH] Failed login attempt");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = await findUserById(req.userId);
    if (!user) {
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Account no longer exists" });
    }
    res.json(user);
  } catch {
    console.error("Error loading current account");
    res.status(500).json({ error: "Error loading current account" });
  }
}

export async function updateEmail(req, res) {
  try {
    const newEmail = normalizeEmail(req.body?.newEmail);
    const { password } = req.body || {};
    if (!newEmail || typeof password !== "string" || !password) {
      return res
        .status(400)
        .json({ error: "New email and password are required" });
    }

    const emailError = validateEmail(newEmail);
    if (emailError) return res.status(400).json({ error: emailError });
    const user = await findUserById(req.userId, true);
    if (!user)
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Account no longer exists" });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    const existing = await findUserByEmail(newEmail);
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const updated = await updateUserEmail(req.userId, newEmail);
    res.json(updated);
  } catch (err) {
    if (isEmailConflict(err))
      return res.status(409).json({ error: "Email already in use" });
    console.error(err);
    res.status(500).json({ error: "Error updating email" });
  }
}

export async function updateUsernameHandler(req, res) {
  try {
    const { newUsername, password } = req.body || {};
    if (!newUsername || typeof password !== "string" || !password) {
      return res
        .status(400)
        .json({ error: "New username and password are required" });
    }
    const usernameError = validateUsername(newUsername);
    if (usernameError) return res.status(400).json({ error: usernameError });

    const user = await findUserById(req.userId, true);
    if (!user)
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Account no longer exists" });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    const existing = await findUserByUsername(newUsername);
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: "Username already in use" });
    }

    const updated = await updateUsername(req.userId, newUsername);
    res.json(updated);
  } catch (err) {
    if (isUsernameConflict(err))
      return res.status(409).json({ error: "Username already in use" });
    console.error(err);
    res.status(500).json({ error: "Error updating username" });
  }
}

export async function deleteAccount(req, res) {
  try {
    const { password } = req.body || {};
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const user = await findUserById(req.userId, true);
    if (!user)
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Account no longer exists" });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    await deleteUser(req.userId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting account" });
  }
}
