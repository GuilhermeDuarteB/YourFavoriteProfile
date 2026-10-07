export function getFrontendOrigin(env = process.env) {
  const value = env.FRONTEND_URL?.trim() || "http://localhost:5173";
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error("FRONTEND_URL must be an HTTP(S) origin without a path");
  }
}

export function validateEnvironment(env = process.env) {
  const missing = [
    "DATABASE_URL",
    "JWT_SECRET",
    "TMDB_API_KEY",
    "RAWG_API_KEY",
  ].filter((name) => !env[name]?.trim());
  if (missing.length)
    throw new Error(
      "Missing required environment variables: " + missing.join(", "),
    );
  try {
    const url = new URL(env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL");
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer between 1 and 65535");
  return { port, frontendOrigin: getFrontendOrigin(env) };
}
