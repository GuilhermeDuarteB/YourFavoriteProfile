import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {findUserById,
  updateUserEmail,
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
        .json({ message: "Username, email, and password are required" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
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
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      console.warn(
        `[AUTH] Failed login attempt for email: ${email} at ${new Date().toISOString()}`,
      );
      return res.status(401).json({ message: "Invalid email or password" });
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
    res.status(500).json({ message: "Internal server error" });
  }
}


export async function updateEmail(req, res) {
  try {
    const {newEmail, password} = req.body;
    if (!newEmail || !password) {
      return res.status(400).json({message: "New email and password are required"});
    }

    const user = await findUserById(req.userId, true);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({message: "Incorrect password"});

    const existing = await findUserByEmail(newEmail);
    if (existing) return res.status(409).json({message: "Email already in use"});

    const updated = await updateUserEmail(req.userId, newEmail);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({message: "Error updating email"});
  }}

export async function deleteAccount(req, res) {
  try {
    const {password} = req.body;
    if (!password) {
      return res.status(400).json({message: "Password is required"});
    }

    const user = await findUserById(req.userId, true);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({message: "Incorrect password"});

    await deleteUser(req.userId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({message: "Error deleting account"});
  }}