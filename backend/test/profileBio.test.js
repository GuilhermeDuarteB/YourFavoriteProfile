import test from "node:test";
import assert from "node:assert/strict";
import { pools } from "../src/config/db.js";
import {
  getPublicProfile,
  updateMyProfile,
} from "../src/controllers/userController.js";

const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
test.after(() => pools.end());

test("profile updates reject invalid/overlong bios before any database access", async () => {
  const query = pools.query;
  let calls = 0;
  pools.query = async () => {
    calls++;
    throw Error("Unexpected database access");
  };
  try {
    for (const bio of [
      "x".repeat(281),
      "n" + "igger",
      123,
      false,
      [],
      {},
      ["text"],
    ]) {
      const res = response();
      await updateMyProfile({ userId: 1, body: { bio } }, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, /bio/i);
    }
    for (const body of [undefined, null, [], "bio"]) {
      const res = response();
      await updateMyProfile({ userId: 1, body }, res);
      assert.equal(res.statusCode, 400);
    }
    assert.equal(calls, 0);
  } finally {
    pools.query = query;
  }
});

test("valid bios retain their text, empty/null clears explicitly, and omitted bio preserves existing data", async () => {
  const query = pools.query;
  let values;
  pools.query = async (_sql, parameters) => {
    values = parameters;
    return { rows: [{ id: 1, bio: parameters[0] }] };
  };
  try {
    for (const bio of ["x".repeat(280), "  A short bio  ", "", null]) {
      const res = response();
      await updateMyProfile({ userId: 1, body: { bio } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(values[0], bio);
      assert.equal(values[3], true);
      assert.equal(values[4], false);
    }
    const res = response();
    await updateMyProfile(
      { userId: 1, body: { avatarUrl: "https://example.com/avatar.png" } },
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(values[3], false);
    assert.equal(values[4], true);
  } finally {
    pools.query = query;
  }
});

test("public profiles suppress legacy blocked bios without rewriting stored data; long benign bios remain intact", async () => {
  const query = pools.query;
  let bio;
  const blocked = "n" + "igger";
  pools.query = async (sql) => {
    assert.doesNotMatch(sql, /\b(UPDATE|DELETE|INSERT)\b/);
    if (sql.includes("LOWER(username)"))
      return { rows: [{ id: 1, username: "Alice", bio }] };
    if (sql.includes("AS followers"))
      return { rows: [{ followers: 0, following: 0 }] };
    if (sql.includes("review_count"))
      return { rows: [{ review_count: 0, avg_score: null }] };
    return { rows: [] };
  };
  try {
    for (const value of [blocked, "x".repeat(5000), null]) {
      bio = value;
      const res = response();
      await getPublicProfile({ params: { username: "alice" } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.bio, value === blocked ? null : value);
      assert.equal(bio, value);
    }
  } finally {
    pools.query = query;
  }
});
