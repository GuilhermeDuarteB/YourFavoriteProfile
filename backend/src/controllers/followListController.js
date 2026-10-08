import { getFollowList } from "../models/followModel.js";
import { findUserByUsername } from "../models/userModel.js";

function positiveInteger(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= max ? number : null;
}

function list(direction) {
  return async (req, res) => {
    const page = positiveInteger(req.query.page, 1, 1000000);
    const pageSize = positiveInteger(req.query.pageSize, 20, 50);
    if (page === null || pageSize === null) {
      return res.status(400).json({
        error:
          "Page must be an integer from 1 to 1000000 and pageSize from 1 to 50",
      });
    }

    try {
      const user = await findUserByUsername(req.params.username);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { users, total } = await getFollowList(
        user.id,
        direction,
        page,
        pageSize,
      );
      return res.json({
        username: user.username,
        users: users.map(({ id, username, avatarUrl }) => ({
          id,
          username,
          avatarUrl,
        })),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      console.error("Unable to load public follow list", { code: err.code });
      return res.status(500).json({ error: "Unable to load this list" });
    }
  };
}

export const getFollowers = list("followers");
export const getFollowing = list("following");
