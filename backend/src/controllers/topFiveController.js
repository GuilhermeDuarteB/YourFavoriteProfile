import { getTopFiveByUser, setTopFive } from '../models/topFiveModel.js';
import { findUserByUsername } from '../models/userModel.js';

export async function putTopFive(req, res) {
  try {
    const { items } = req.body; // [{ mediaId, rank }, ...]
    if (!Array.isArray(items) || items.length > 5) {
      return res.status(400).json({ error: 'items must be an array of up to 5 entries' });
    }

    const ranks = items.map((i) => i.rank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== ranks.length || ranks.some((r) => r < 1 || r > 5)) {
      return res.status(400).json({ error: 'Each item needs a unique rank between 1 and 5' });
    }

    await setTopFive(req.userId, items);
    const updated = await getTopFiveByUser(req.userId);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating top 5' });
  }
}

export async function getTopFiveForUsername(req, res) {
  try {
    const user = await findUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const topFive = await getTopFiveByUser(user.id);
    res.json(topFive);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading top 5' });
  }
}