import pg from "pg";
import { randomBytes } from "node:crypto";

// Tests/restores may drop only a database this instance successfully created.
export async function createTestDatabase(adminUrl) {
  const admin = new pg.Pool({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5000,
  });
  const name = "yfp_migration_test_" + randomBytes(10).toString("hex");
  let created = false;
  let pool;
  try {
    await admin.query('CREATE DATABASE "' + name + '" TEMPLATE template0');
    created = true;
    const url = new URL(adminUrl);
    url.pathname = "/" + name;
    pool = new pg.Pool({
      connectionString: url.href,
      connectionTimeoutMillis: 5000,
    });
    return {
      name,
      url: url.href,
      pool,
      async dispose() {
        await pool.end();
        if (created && /^yfp_migration_test_[a-f0-9]{20}$/.test(name)) {
          await admin.query('DROP DATABASE "' + name + '"');
          created = false;
        }
        await admin.end();
      },
    };
  } catch (error) {
    if (pool) await pool.end();
    if (created) await admin.query('DROP DATABASE "' + name + '"');
    await admin.end();
    throw error;
  }
}
