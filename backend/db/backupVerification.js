import { isDeepStrictEqual } from "node:util";
import { databaseSnapshot } from "./snapshot.js";
import { schemaSignature } from "./schema.js";

const quote = (name) => '"' + name.replaceAll('"', '""') + '"';

// Catalog OIDs and physical storage details are intentionally not identities.
// Owners, ACLs, sequence definitions/dependencies and history ARE verified.
export async function backupSnapshot(client) {
  const snapshot = await databaseSnapshot(client);
  const hasHistory = (
    await client.query("SELECT to_regclass('public.schema_migrations') AS name")
  ).rows[0].name;
  snapshot.history = hasHistory
    ? (
        await client.query(
          "SELECT * FROM public.schema_migrations ORDER BY version",
        )
      ).rows
    : null;
  snapshot.historySchema = hasHistory
    ? await schemaSignature(client, ["schema_migrations"])
    : null;
  const queries = {
    schemas: `SELECT nspname AS name, pg_get_userbyid(nspowner) AS owner,
      ARRAY(SELECT unnest(nspacl)::text ORDER BY 1) AS acl FROM pg_namespace
      WHERE nspname !~ '^pg_' AND nspname <> 'information_schema' ORDER BY nspname`,
    extensions: `SELECT extname AS name, extversion AS version,
      pg_get_userbyid(extowner) AS owner, n.nspname AS schema
      FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY extname`,
    objects: `SELECT c.relname AS name, c.relkind AS kind,
      pg_get_userbyid(c.relowner) AS owner,
      ARRAY(SELECT unnest(c.relacl)::text ORDER BY 1) AS acl, c.reloptions AS options
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' ORDER BY c.relname`,
    sequenceDefinitions: `SELECT sequencename AS name, data_type::text,
      start_value::text, min_value::text, max_value::text, increment_by::text,
      cycle, cache_size::text FROM pg_sequences WHERE schemaname='public'
      ORDER BY sequencename`,
    sequenceOwnership: `SELECT s.relname AS name, tn.nspname AS table_schema,
      t.relname AS table_name, a.attname AS column_name, d.deptype AS dependency
      FROM pg_class s JOIN pg_namespace n ON n.oid=s.relnamespace
      JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid
        AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i')
      JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=t.relnamespace
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
      WHERE n.nspname='public' AND s.relkind='S' ORDER BY s.relname`,
    defaultPrivileges: `SELECT pg_get_userbyid(d.defaclrole) AS owner,
      n.nspname AS schema, d.defaclobjtype AS type,
      ARRAY(SELECT unnest(d.defaclacl)::text ORDER BY 1) AS acl
      FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
      ORDER BY owner, schema, type`,
  };
  snapshot.catalog = {};
  for (const [name, sql] of Object.entries(queries))
    snapshot.catalog[name] = (await client.query(sql)).rows;
  return snapshot;
}

// Run ONLY on the disposable restore connection. PostgreSQL's own parser
// canonicalizes dumped expressions, retaining every operator, literal and cast.
// No regex replacement or exclusion of CHECK constraints is involved.
export async function verifyBackup(client, snapshot) {
  const expected = structuredClone(snapshot);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL search_path TO public, pg_catalog");
    for (const table of new Set(
      expected.schema.constraints.map((c) => c.table_name),
    )) {
      const checks = expected.schema.constraints.filter(
        (c) => c.table_name === table && c.type === "c",
      );
      if (!checks.length) continue;
      const columns = expected.schema.columns.filter(
        (c) => c.table_name === table,
      );
      await client.query(
        "CREATE TEMP TABLE backup_check_verification (" +
          columns.map((c) => quote(c.name) + " " + c.type).join(", ") +
          ")",
      );
      for (const check of checks) {
        await client.query(
          "ALTER TABLE pg_temp.backup_check_verification ADD CONSTRAINT " +
            quote(check.name) +
            " " +
            check.definition,
        );
        check.definition = (
          await client.query(
            "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='pg_temp.backup_check_verification'::regclass AND conname=$1",
            [check.name],
          )
        ).rows[0].definition;
      }
      await client.query("DROP TABLE pg_temp.backup_check_verification");
    }
    for (const schema of [expected.schema, expected.historySchema].filter(
      Boolean,
    )) {
      for (const view of schema.views) {
        await client.query(
          "CREATE TEMP VIEW backup_view_verification AS " + view.definition,
        );
        view.definition = (
          await client.query(
            "SELECT pg_get_viewdef('pg_temp.backup_view_verification'::regclass, true) AS definition",
          )
        ).rows[0].definition;
        await client.query("DROP VIEW pg_temp.backup_view_verification");
      }
    }
    const recovered = await backupSnapshot(client);
    for (const section of Object.keys(expected)) {
      if (!isDeepStrictEqual(recovered[section], expected[section])) {
        // Report object/property paths only, never row values or assertion payloads.
        const details = [];
        for (const key of Object.keys(expected[section] || {})) {
          if (
            !isDeepStrictEqual(
              recovered[section]?.[key],
              expected[section][key],
            )
          )
            details.push(key);
        }
        throw new Error(
          "Restored " +
            section +
            " differs from backup snapshot: " +
            details.join(", "),
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
