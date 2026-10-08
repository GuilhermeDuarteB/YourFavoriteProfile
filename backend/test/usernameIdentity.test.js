import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { pools } from "../src/config/db.js";
import {
  register,
  updateUsernameHandler,
} from "../src/controllers/authController.js";

const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
  },
});
test.after(() => pools.end());

test("only recognized username uniqueness errors become 409 responses", async () => {
  const original = {
    query: pools.query,
    compare: bcrypt.compare,
    hash: bcrypt.hash,
    error: console.error,
  };
  bcrypt.compare = async () => true;
  bcrypt.hash = async () => "test-hash";
  console.error = () => {};
  try {
    for (const handler of [register, updateUsernameHandler]) {
      for (const [code, constraint, status] of [
        ["23505", "users_username_lower_unique", 409],
        ["23505", "users_username_key", 409],
        ["23505", "other_unique", 500],
        ["23503", "users_username_lower_unique", 500],
      ]) {
        pools.query = async (sql) => {
          if (sql.startsWith("INSERT") || sql.startsWith("UPDATE"))
            throw Object.assign(Error("Private database details"), {
              code,
              constraint,
            });
          return {
            rows: sql.includes("WHERE id = $1")
              ? [{ id: 1, password_hash: "test-hash" }]
              : [],
          };
        };
        const res = response();
        await handler(
          {
            userId: 1,
            body: {
              username: "Guilherme",
              newUsername: "Guilherme",
              email: "test@example.com",
              password: "password123",
            },
          },
          res,
        );
        assert.equal(res.statusCode, status);
        if (status === 409)
          assert.equal(res.body.error, "Username already in use");
        assert.doesNotMatch(res.body.error, /Private database/);
      }
    }
  } finally {
    pools.query = original.query;
    bcrypt.compare = original.compare;
    bcrypt.hash = original.hash;
    console.error = original.error;
  }
});
