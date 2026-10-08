// Catalog-only verification; never reads or rewrites application row values.
export const TABLES = [
  "users",
  "media",
  "seasons",
  "episodes",
  "reviews",
  "watchlist",
  "top_five",
  "follows",
];
export const VIEWS = ["vw_media_rating", "vw_series_rating"];

export async function schemaSignature(client, tables = TABLES) {
  const columns = await client.query(
    `
    SELECT c.relname AS table_name, a.attname AS name,
      format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null,
      pg_get_expr(d.adbin, d.adrelid) AS default_value, a.attidentity AS identity,
      a.attgenerated AS generated
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relname=ANY($1)
    ORDER BY c.relname, a.attnum`,
    [tables],
  );
  const constraints = await client.query(
    `
    SELECT c.relname AS table_name, con.conname AS name, con.contype AS type,
      pg_get_constraintdef(con.oid) AS definition, con.convalidated AS validated
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1) AND con.contype <> 'n'
    ORDER BY c.relname, con.conname`,
    [tables],
  );
  const indexes = await client.query(
    `
    SELECT c.relname AS table_name, i.relname AS name, pg_get_indexdef(x.indexrelid) AS definition,
      x.indisvalid AS valid, x.indisready AS ready
    FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid
    JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1) ORDER BY c.relname,i.relname`,
    [tables],
  );
  const views = await client.query(
    `
    SELECT c.relname AS name, pg_get_viewdef(c.oid, true) AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v' AND c.relname=ANY($1) ORDER BY c.relname`,
    [VIEWS],
  );
  return {
    columns: columns.rows,
    constraints: constraints.rows,
    indexes: indexes.rows,
    views: views.rows,
  };
}

export async function verifyBaseline(client, expected) {
  const actual = await schemaSignature(client);
  // pg_dump/restore may move this text-array cast onto its literal elements.
  // Accept only that known equivalent rendering of the historical media view;
  // all other expressions and all table/index metadata remain exact matches.
  for (const view of actual.views) {
    if (view.name === "vw_media_rating")
      view.definition = view.definition.replace(
        "ARRAY['movie'::character varying::text, 'game'::character varying::text]",
        "ARRAY['movie'::character varying, 'game'::character varying]::text[]",
      );
  }
  const ordered = (rows) =>
    [...rows].sort(
      (a, b) =>
        (a.table_name || "").localeCompare(b.table_name || "") ||
        a.name.localeCompare(b.name),
    );
  for (const section of Object.keys(expected)) {
    if (
      JSON.stringify(ordered(actual[section])) !==
      JSON.stringify(ordered(expected[section]))
    ) {
      throw new Error(
        "Baseline adoption refused: " +
          section +
          " do not match the historical baseline. Compare the catalog with db/baseline-signature.json.",
      );
    }
  }
}
