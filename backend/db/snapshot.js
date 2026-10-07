import { createHash } from "node:crypto";
import { TABLES, VIEWS, schemaSignature } from "./schema.js";

// Fingerprints verify preservation without writing personal data to reports/logs.
export async function databaseSnapshot(client) {
  const tables = {};
  for (const table of TABLES) {
    const { rows } = await client.query(
      "SELECT row_to_json(t) AS row FROM public." + table + " t ORDER BY id",
    );
    tables[table] = {
      count: rows.length,
      sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }
  const sequences = {};
  for (const table of TABLES) {
    sequences[table] = (
      await client.query(
        "SELECT last_value::text, is_called FROM public." + table + "_id_seq",
      )
    ).rows[0];
  }
  const views = {};
  for (const view of VIEWS) {
    views[view] = (
      await client.query("SELECT * FROM public." + view + " ORDER BY media_id")
    ).rows;
  }
  const schema = await schemaSignature(client);
  for (const rows of Object.values(schema))
    rows.sort(
      (a, b) =>
        (a.table_name || "").localeCompare(b.table_name || "") ||
        a.name.localeCompare(b.name),
    );
  return { tables, sequences, views, schema };
}
