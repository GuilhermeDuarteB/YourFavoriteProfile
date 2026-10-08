import pkg from "pg";
const { Pool } = pkg;

function getPoolConfig(connectionString = process.env.DATABASE_URL) {
  const config = { connectionString, connectionTimeoutMillis: 5000 };
  if (!connectionString) return config;
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") === "require") config.ssl = {};
  return config;
}

export const pools = new Pool(getPoolConfig());
pools.on("error", () =>
  console.error("Unexpected idle database connection error"),
);
