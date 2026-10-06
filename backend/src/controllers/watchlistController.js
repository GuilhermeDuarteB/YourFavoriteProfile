import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlistByUser,
  findWatchlistEntry,
} from '../models/watchlistModel.js';

const VALID_STATUSES = ['want_to_watch', 'watching', 'completed', 'dropped'];

export async function postWatchlist(req, res) {
  try {
    const { mediaId, status } = req.body;
    if (!mediaId) return res.status(400).json({ error: 'mediaId is required' });
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const entry = await addToWatchlist(req.userId, mediaId, status || 'want_to_watch');
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error adding to watchlist' });
  }
}

export async function deleteWatchlist(req, res) {
  try {
    await removeFromWatchlist(req.userId, req.params.mediaId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error removing from watchlist' });
  }
}

export async function getMyWatchlist(req, res) {
  try {
    const { status } = req.query;
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    const list = await getWatchlistByUser(req.userId, status || null);
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error loading watchlist' });
  }
}

export async function getWatchlistStatus(req, res) {
  try {
    const entry = await findWatchlistEntry(req.userId, req.params.mediaId);
    res.json({ inWatchlist: !!entry, status: entry?.status || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error checking watchlist' });
  }
}