import { findUserByUsername, searchUsersByUsername } from '../models/userModel.js';

export async function getPublicProfile(req, res) {
  try {
    const user = await findUserByUsername(req.params.username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading profile' });
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
    res.status(500).json({ error: 'Error searching users' });
  }
}