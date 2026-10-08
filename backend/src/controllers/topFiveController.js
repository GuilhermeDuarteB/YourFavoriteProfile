import { getTopFiveByUser, setTopFive } from '../models/topFiveModel.js';
import { findUserByUsername } from '../models/userModel.js';

export async function putTopFive(req, res) {
  try {
    const { items } = req.body || {}; // [{ mediaId, rank }, ...]
    if (!Array.isArray(items) || items.length > 5) {
      return res.status(400).json({ error: 'items must be an array of up to 5 entries' });
    }

    if (items.some((item) => !item || !Number.isSafeInteger(item.mediaId) || item.mediaId <= 0)) {
      return res.status(400).json({ error: 'Each mediaId must be a positive integer' });
    }
    if (new Set(items.map((item) => item.mediaId)).size !== items.length) {
      return res.status(400).json({ error: 'Media IDs must be unique' });
    }
    const ranks = items.map((i) => i.rank);
    const uniqueRanks = new Set(ranks);
    if (uniqueRanks.size !== ranks.length || ranks.some((r) => !Number.isInteger(r) || r < 1 || r > 5)) {
      return res.status(400).json({ error: 'Each item needs a unique rank between 1 and 5' });
    }

    await setTopFive(req.userId, items);
    const updated = await getTopFiveByUser(req.userId);
    res.json(updated);
  } catch (err) {
    if (err.code === 'TOP_FIVE_UNAVAILABLE') return res.status(409).json({ error: err.message });
    if (err.code === 'MEDIA_UNAVAILABLE') return res.status(400).json({ error: err.message });
    if (err.code === '23503') return res.status(400).json({ error: 'One or more media IDs do not exist' });
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
