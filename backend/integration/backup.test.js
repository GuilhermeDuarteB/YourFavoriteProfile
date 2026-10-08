import test from "node:test";
import assert from "node:assert/strict";
import { createTestDatabase } from "../db/testDatabase.js";
import { migrate } from "../db/migrate.js";
import { backupSnapshot, verifyBackup } from "../db/backupVerification.js";

assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is required");
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';

test("backup verifier preserves PostgreSQL semantics and rejects restore corruption", async (t) => {
  const db = await createTestDatabase(process.env.TEST_DATABASE_URL);
  let client;
  try {
    await migrate(db.pool, { log() {} });
    client = await db.pool.connect();
    await client.query("SET TIME ZONE 'UTC'");
    await client.query(
      "INSERT INTO users(username,email,password_hash) VALUES ('BackupUser','backup@example.com','test')",
    );
    const snapshot = await backupSnapshot(client);
    // Re-execute catalog SQL just as pg_restore does. Real PostgreSQL reparses
    // the array casts; this regression does not mock database expressions.
    for (const check of snapshot.schema.constraints.filter(
      (c) => c.type === "c",
    )) {
      await client.query(
        "ALTER TABLE public." +
          quote(check.table_name) +
          " DROP CONSTRAINT " +
          quote(check.name),
      );
      await client.query(
        "ALTER TABLE public." +
          quote(check.table_name) +
          " ADD CONSTRAINT " +
          quote(check.name) +
          " " +
          check.definition,
      );
    }
    for (const view of snapshot.schema.views)
      await client.query(
        "CREATE OR REPLACE VIEW public." +
          quote(view.name) +
          " AS " +
          view.definition,
      );
    await t.test(
      "equivalent dump/restore expression representations pass",
      async () => {
        assert.notDeepEqual(
          (await backupSnapshot(client)).schema,
          snapshot.schema,
        );
        await verifyBackup(client, snapshot);
      },
    );

    const cases = [
      [
        "missing table",
        "ALTER TABLE follows RENAME TO missing_follows",
        "ALTER TABLE missing_follows RENAME TO follows",
      ],
      [
        "missing constraint",
        "ALTER TABLE media DROP CONSTRAINT media_type_check",
        "ALTER TABLE media ADD CONSTRAINT media_type_check " +
          (await backupSnapshot(client)).schema.constraints.find(
            (c) => c.name === "media_type_check",
          ).definition,
      ],
      [
        "altered check semantics",
        "ALTER TABLE reviews DROP CONSTRAINT reviews_positive_score_check; ALTER TABLE reviews ADD CONSTRAINT reviews_positive_score_check CHECK(score>=0 AND score<=10)",
        "ALTER TABLE reviews DROP CONSTRAINT reviews_positive_score_check; ALTER TABLE reviews ADD CONSTRAINT reviews_positive_score_check CHECK(score>0 AND score<=10)",
      ],
      [
        "missing index",
        "DROP INDEX users_username_lower_unique",
        "CREATE UNIQUE INDEX users_username_lower_unique ON users(LOWER(username))",
      ],
      [
        "changed column type",
        "ALTER TABLE users ALTER COLUMN username TYPE varchar(51)",
        "ALTER TABLE users ALTER COLUMN username TYPE varchar(50)",
      ],
      [
        "changed column default",
        "ALTER TABLE watchlist ALTER COLUMN status SET DEFAULT 'completed'",
        "ALTER TABLE watchlist ALTER COLUMN status SET DEFAULT 'want_to_watch'",
      ],
      [
        "changed row contents",
        "UPDATE users SET username='ChangedUser'",
        "UPDATE users SET username='BackupUser'",
      ],
      [
        "changed sequence value",
        "SELECT setval('users_id_seq', 99)",
        "SELECT setval('users_id_seq', 1)",
      ],
      [
        "changed migration history",
        "UPDATE schema_migrations SET checksum='changed' WHERE version=1",
        null,
      ],
    ];
    for (const [name, change, undo] of cases) {
      await t.test(name + " is rejected", async () => {
        await client.query(change);
        await assert.rejects(verifyBackup(client, snapshot));
        if (undo) {
          await client.query(undo);
          await verifyBackup(client, snapshot);
        }
      });
    }
  } finally {
    if (client) client.release();
    await db.dispose();
  }
});
