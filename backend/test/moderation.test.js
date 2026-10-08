import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  containsBlockedContent,
  containsBlockedUsername,
  isBlockedMedia,
  publicBio,
} from "../src/utils/moderation.js";
import {
  validateBio,
  validateReview,
  validateUsername,
} from "../src/utils/validation.js";
import {
  moderateUsernames,
  planUsernameRenames,
} from "../src/utils/usernameMaintenance.js";
import {
  register,
  updateUsernameHandler,
  getCurrentUser,
  login,
} from "../src/controllers/authController.js";
import { pools } from "../src/config/db.js";
import bcrypt from "bcrypt";

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
const query = pools.query;
const compare = bcrypt.compare;
const blockedTerm = "nigger";
const otherBlockedTerm = "wetback";
const portugueseTerms = ["pretalhada", "negralhada"];
test.afterEach(() => {
  pools.query = query;
  bcrypt.compare = compare;
});
test.after(() => pools.end());

test("explicit language policy handles common casing, Unicode and obfuscation", () => {
  for (const value of [
    "NIGGER",
    "n.i.g.g.e.r",
    "n_i_g_g_a",
    "n i g g e r",
    "n1gg3r",
    "n!gg@",
    "nnniiiggggeerr",
    "nïggér",
    "ｎｉｇｇｅｒ",
    "nіggеr",
    "ni\u200bgger",
    "nigger123",
    "The wetbacks",
    "rag-head",
    "towelhead",
    "porch monkey",
  ]) {
    assert.equal(containsBlockedContent(value), true);
  }
});

test("policy preserves innocent substrings, ethnicity names and ordinary text", () => {
  for (const value of [
    "Niger",
    "Nigerian",
    "Nigeria",
    "snigger",
    "sniggering",
    "niggardly",
    "Black African Asian Jewish Arab Indian",
    "Scunthorpe",
    "Kike",
    "raccoon",
    "spice",
    "A chink in the armor",
    "My back is wet",
    "action_rpg_123",
    "A story about the fight against racism",
    undefined,
    null,
    {},
  ]) {
    assert.equal(containsBlockedContent(value), false);
  }
});

test("bounded concatenated blocked terms are rejected across user content and legacy bios", () => {
  for (const value of [
    blockedTerm + blockedTerm,
    blockedTerm + otherBlockedTerm,
    otherBlockedTerm + blockedTerm,
    blockedTerm.repeat(5),
    blockedTerm.replaceAll("i", "1").replaceAll("e", "3").repeat(2),
  ]) {
    assert.equal(containsBlockedContent(value), true);
    assert.match(validateUsername(value), /hateful language/);
    assert.match(validateBio(`Text ${value} text`), /hateful language/);
    assert.match(validateReview(8, value), /hateful language/);
    assert.equal(publicBio(value), null);
    assert.equal(isBlockedMedia({ title: `The ${value} story` }), true);
    // Only complete chains, not arbitrary substrings inside larger words.
    for (const prose of [`prefix${value}`, `${value}suffix`, `s${value}`]) {
      assert.equal(containsBlockedContent(prose), false);
      assert.equal(isBlockedMedia({ title: prose }), false);
    }
  }
});

test("username decorations use the same conservative rule in validation and cleanup planning", () => {
  const names = [
    `xx${blockedTerm}xx`,
    `123${blockedTerm}456`,
    `Xx_${blockedTerm + otherBlockedTerm}_xX`,
  ];
  const users = names.map((username, index) => ({ id: index + 1, username }));
  const before = structuredClone(users);
  for (const name of names) {
    assert.equal(containsBlockedUsername(name), true);
    assert.match(validateUsername(name), /hateful language/);
  }
  assert.deepEqual(
    planUsernameRenames(users),
    users.map(({ id }) => ({ id, username: `user${id}` })),
  );
  assert.deepEqual(users, before);
  assert.equal(containsBlockedContent(names[0]), false);
  assert.equal(isBlockedMedia({ title: names[0] }), false);
  for (const name of [
    "xxNigerxx",
    "snigger",
    "niggardly",
    "Player123",
    "Xavier",
    "xenon",
  ]) {
    assert.equal(containsBlockedUsername(name), false);
    assert.equal(validateUsername(name), null);
  }
});

test("Portuguese coverage targets derogatory collectives and preserves ordinary meanings", () => {
  for (const term of portugueseTerms) {
    for (const value of [
      term,
      term.toUpperCase(),
      term + term,
      term.split("").join("."),
      term.replaceAll("a", "4"),
    ]) {
      assert.equal(containsBlockedContent(value), true);
      assert.match(validateUsername(value), /hateful language/);
      assert.match(validateBio(value), /hateful language/);
      assert.match(validateReview(8, value), /hateful language/);
    }
    assert.deepEqual(planUsernameRenames([{ id: 8, username: term }]), [
      { id: 8, username: "user8" },
    ]);
  }
  for (const value of [
    "preto",
    "negro",
    "negra",
    "africano",
    "africana",
    "brasileiro",
    "cigano",
    "crioulo",
    "macaco",
    "Uma camisa preta e um gato preto",
    "A cultura negra e a língua crioula",
    "Um macaco na floresta",
    "Niger",
    "Nigeria",
    "nigeriano",
    "trapalhada",
  ]) {
    assert.equal(containsBlockedContent(value), false);
    assert.equal(containsBlockedUsername(value), false);
    assert.equal(isBlockedMedia({ title: value }), false);
  }
});

test("Unicode lookalikes normalize by their intended code points", () => {
  for (const [letter, lookalikes, term] of [
    ["a", ["\u0430", "\u03b1"], otherBlockedTerm],
    ["e", ["\u0435", "\u03b5"], blockedTerm],
    ["i", ["\u0456", "\u03b9", "\u0131"], blockedTerm],
    ["o", ["\u043e", "\u03bf"], "towelhead"],
    ["g", ["\u0261"], blockedTerm],
  ]) {
    for (const lookalike of lookalikes) {
      const value = term.replaceAll(letter, lookalike);
      assert.equal(containsBlockedContent(value), true);
      assert.equal(containsBlockedContent(value.repeat(2)), true);
    }
  }
  assert.equal(containsBlockedContent("N\u0456ger"), false);
  assert.equal(containsBlockedContent("N\u0456geria"), false);
});

test("long separator and substitution input does not cause regex backtracking", () => {
  const source = `import { containsBlockedContent } from './src/utils/moderation.js';
    for (const character of ['!', '@', '|', '+', '$', '.', ' ']) {
      if (containsBlockedContent('n' + character.repeat(10000) + 'x')) process.exit(1);
    }
    const term = ${JSON.stringify(blockedTerm)};
    if (!containsBlockedContent(term.repeat(2000))) process.exit(1);
    if (containsBlockedContent(term.repeat(2000) + 'suffix')) process.exit(1);`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      timeout: 5000,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0);
});

test("bios enforce the textarea length, types and policy without truncating legacy text", () => {
  for (const value of [undefined, null, "", "a".repeat(280)]) {
    assert.equal(validateBio(value), null);
  }
  for (const value of [false, 123, [], {}, "a".repeat(281), "n1gg3r"]) {
    assert.equal(typeof validateBio(value), "string");
  }
  assert.equal(publicBio("a".repeat(2000)).length, 2000);
  assert.equal(publicBio("n1gg3r"), null);
  assert.equal(publicBio(null), null);
  assert.equal(
    validateReview(8.5, "n1gg3r"),
    "Comment must not contain hateful language",
  );
  assert.equal(validateReview(8.5, "A story set in Niger"), null);
});

test("title moderation checks displayed and original titles without blocking innocent substrings", () => {
  for (const key of ["title", "name", "original_title", "original_name"]) {
    assert.equal(isBlockedMedia({ [key]: "The n1gg3r story" }), true);
    assert.equal(isBlockedMedia({ [key]: "Niger: A History" }), false);
  }
  assert.equal(isBlockedMedia(null), false);
  assert.equal(isBlockedMedia(undefined), false);
});

test("registration and username changes reject hateful usernames before touching the database", async () => {
  pools.query = () => assert.fail("Invalid username reached the database");
  for (const username of [
    "nigger",
    "N1GG3R",
    "n_i_g_g_a",
    "wetback123",
    blockedTerm + blockedTerm,
    blockedTerm + otherBlockedTerm,
    `xx${blockedTerm}xx`,
    ...portugueseTerms,
  ]) {
    assert.match(validateUsername(username), /hateful language/);
    for (const handler of [register, updateUsernameHandler]) {
      const res = response();
      await handler(
        {
          userId: 1,
          body: {
            username,
            newUsername: username,
            email: "test@example.com",
            password: "password123",
          },
        },
        res,
      );
      assert.equal(res.statusCode, 400);
      assert.equal(
        res.body.error,
        "Choose a username without hateful language",
      );
      assert.equal(res.body.error.includes(username), false);
    }
  }
});

test("neutral rename planning is deterministic, collision safe and idempotent", () => {
  const users = [
    { id: 8, username: "wetback", email: "unchanged@example.com" },
    { id: 2, username: "nigger", password_hash: "unchanged" },
    { id: 3, username: "User2" },
    { id: 4, username: "USER2_1" },
    { id: 5, username: "Alice" },
  ];
  const snapshot = structuredClone(users);
  const expected = [
    { id: 2, username: "user2_2" },
    { id: 8, username: "user8" },
  ];
  assert.deepEqual(planUsernameRenames(users), expected);
  assert.deepEqual(planUsernameRenames([...users].reverse()), expected);
  assert.deepEqual(users, snapshot);
  const renamed = users.map((user) => ({
    ...user,
    ...expected.find((row) => row.id === user.id),
  }));
  assert.deepEqual(planUsernameRenames(renamed), []);
  assert.equal(renamed.find((user) => user.id === 8).email, users[0].email);
  assert.equal(
    renamed.find((user) => user.id === 2).password_hash,
    users[1].password_hash,
  );
});

test("maintenance defaults to a read-only transaction and apply updates usernames by ID only", async () => {
  const users = [
    { id: 2, username: "nigger" },
    { id: 3, username: "User2" },
  ];
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT")) return { rows: structuredClone(users) };
      if (sql.startsWith("UPDATE")) {
        assert.equal(
          sql,
          "UPDATE public.users SET username = $1 WHERE id = $2",
        );
        users.find((user) => user.id === params[1]).username = params[0];
        return { rowCount: 1 };
      }
      return {};
    },
    release() {
      calls.push({ sql: "RELEASE" });
    },
  };
  const pool = { connect: async () => client };
  const before = structuredClone(users);
  const plan = await moderateUsernames(pool);
  assert.deepEqual(plan, [{ id: 2, username: "user2_1" }]);
  assert.deepEqual(users, before);
  assert.equal(calls[0].sql, "BEGIN READ ONLY");
  assert.ok(calls.every(({ sql }) => !/UPDATE|INSERT|DELETE|LOCK/.test(sql)));
  calls.length = 0;
  assert.deepEqual(await moderateUsernames(pool, { apply: true }), plan);
  assert.equal(
    calls[2].sql,
    "LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE",
  );
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
  assert.deepEqual(users, [{ id: 2, username: "user2_1" }, before[1]]);
  assert.deepEqual(await moderateUsernames(pool, { apply: true }), []);
});

test("maintenance rolls back and releases on a failed username update", async () => {
  const calls = [];
  const failure = Object.assign(new Error("private DB detail"), {
    code: "23505",
  });
  const pool = {
    connect: async () => ({
      async query(sql) {
        calls.push(sql);
        if (sql.startsWith("SELECT"))
          return { rows: [{ id: 7, username: "nigger" }] };
        if (sql.startsWith("UPDATE")) throw failure;
        return {};
      },
      release() {
        calls.push("RELEASE");
      },
    }),
  };
  await assert.rejects(moderateUsernames(pool, { apply: true }), failure);
  assert.deepEqual(calls.slice(-2), ["ROLLBACK", "RELEASE"]);
});

test("renamed accounts keep email login and refresh the current username by token user ID", async () => {
  const user = {
    id: 2,
    username: "user2",
    email: "test@example.com",
    password_hash: "hash",
    bio: "legacy bio",
  };
  pools.query = async (sql, params) => {
    if (sql.includes("LOWER(TRIM(email))")) {
      assert.deepEqual(params, [user.email]);
      return { rows: [user] };
    }
    assert.deepEqual(params, [2]);
    assert.doesNotMatch(sql, /password_hash/);
    const { password_hash, ...safe } = user;
    return { rows: [safe] };
  };
  bcrypt.compare = async () => true;
  process.env.JWT_SECRET = "test-only-secret";
  let res = response();
  await login({ body: { email: user.email, password: "old-password" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.id, 2);
  assert.equal(res.body.user.username, "user2");
  assert.equal(res.body.user.password_hash, undefined);
  res = response();
  await getCurrentUser({ userId: 2 }, res);
  assert.equal(res.body.username, "user2");
  assert.equal(res.body.password_hash, undefined);
  pools.query = async () => ({ rows: [] });
  res = response();
  await getCurrentUser({ userId: 2 }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "INVALID_TOKEN");
});

test("maintenance CLI fails without a database URL and does not print environment secrets", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/moderate-usernames.js"],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: {
        ...process.env,
        DOTENV_CONFIG_PATH: "test/nonexistent.env",
        DATABASE_URL: "",
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Username maintenance failed/);
  assert.doesNotMatch(result.stdout + result.stderr, /postgresql:\/\//);
});
