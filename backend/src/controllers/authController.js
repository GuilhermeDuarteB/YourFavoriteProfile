import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
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

export async function register(req, res) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email, and password are required" });
    }

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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      console.warn(
        `[AUTH] Failed login attempt for email: ${email} at ${new Date().toISOString()}`,
      );
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

export async function updateEmail(req, res) {
  try {
    const { newEmail, password } = req.body;
    if (!newEmail || !password) {
      return res
        .status(400)
        .json({ error: "New email and password are required" });
    }

    const user = await findUserById(req.userId, true);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    const existing = await findUserByEmail(newEmail);
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const updated = await updateUserEmail(req.userId, newEmail);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating email" });
  }
}

export async function updateUsernameHandler(req, res) {
  try {
    const { newUsername, password } = req.body;
    if (!newUsername || !password) {
      return res
        .status(400)
        .json({ error: "New username and password are required" });
    }
    if (newUsername.length < 3 || newUsername.length > 50) {
      return res
        .status(400)
        .json({ error: "Username must be between 3 and 50 characters" });
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(newUsername)) {
      return res
        .status(400)
        .json({
          error:
            "Username can only contain letters, numbers, dots, and underscores",
        });
    }

    const user = await findUserById(req.userId, true);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    const existing = await findUserByUsername(newUsername);
    if (existing && existing.id !== req.userId) {
      return res.status(409).json({ error: "Username already in use" });
    }

    const updated = await updateUsername(req.userId, newUsername);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error updating username" });
  }
}

export async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const user = await findUserById(req.userId, true);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Incorrect password" });

    await deleteUser(req.userId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error deleting account" });
  }
}
