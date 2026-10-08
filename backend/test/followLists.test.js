import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { pools } from "../src/config/db.js";
import userRoutes from "../src/routes/userRoutes.js";
import {
  getFollowers,
  getFollowing,
} from "../src/controllers/followListController.js";

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

test("public followers and following resolve alternate casing and return only paginated public fields", async () => {
  const original = pools.query;
  try {
    for (const [handler, ownerColumn, memberColumn] of [
      [getFollowers, "following_id", "follower_id"],
      [getFollowing, "follower_id", "following_id"],
    ]) {
      const calls = [];
      pools.query = async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes("LOWER(username) = LOWER($1)"))
          return { rows: [{ id: 7, username: "Alice" }] };
        if (sql.includes("COUNT(*)")) return { rows: [{ total: "21" }] };
        return {
          rows: [
            {
              id: 8,
              username: "Bob",
              avatarUrl: null,
              email: "private@example.com",
              password_hash: "private",
            },
          ],
        };
      };
      const res = response();
      await handler(
        { params: { username: "ALICE" }, query: { page: "2", pageSize: "20" } },
        res,
      );
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, {
        username: "Alice",
        users: [{ id: 8, username: "Bob", avatarUrl: null }],
        page: 2,
        pageSize: 20,
        total: 21,
        totalPages: 2,
      });
      assert.deepEqual(calls[0].values, ["ALICE"]);
      assert.match(calls[1].sql, new RegExp(`WHERE ${ownerColumn} = \\$1`));
      assert.match(calls[2].sql, new RegExp(`u.id = f.${memberColumn}`));
      assert.match(
        calls[2].sql,
        /ORDER BY LOWER\(u.username\), u.id LIMIT \$2 OFFSET \$3/,
      );
      assert.deepEqual(calls[2].values, [7, 20, 20]);
      assert.doesNotMatch(calls[2].sql, /email|password|SELECT \*/);
    }
  } finally {
    pools.query = original;
  }
});

test("follow list pagination rejects malformed or excessive values before querying", async () => {
  const original = pools.query;
  pools.query = async () => {
    throw new Error("No database queries expected");
  };
  try {
    for (const query of [
      { page: "0" },
      { page: "-1" },
      { page: "1.5" },
      { page: "1e2" },
      { page: "1000001" },
      { page: ["1", "2"] },
      { page: {} },
      { pageSize: "0" },
      { pageSize: "51" },
      { pageSize: "20x" },
      { pageSize: "" },
    ]) {
      const res = response();
      await getFollowers({ params: { username: "Alice" }, query }, res);
      assert.equal(res.statusCode, 400, JSON.stringify(query));
    }
  } finally {
    pools.query = original;
  }
});

test("public list routes need no authentication, return empty pages, and report nonexistent profiles", async () => {
  const original = pools.query;
  pools.query = async (sql, values) => {
    if (sql.includes("LOWER(username)"))
      return {
        rows: values[0] === "Missing" ? [] : [{ id: 7, username: "Alice" }],
      };
    return { rows: sql.includes("COUNT(*)") ? [{ total: "0" }] : [] };
  };
  const app = express();
  app.use("/api/users", userRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const direction of ["followers", "following"]) {
      const result = await fetch(`${base}/api/users/ALICE/${direction}`);
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), {
        username: "Alice",
        users: [],
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      });
      const missing = await fetch(`${base}/api/users/Missing/${direction}`);
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), { error: "User not found" });
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    pools.query = original;
  }
});
