export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function validateUsername(username) {
  if (
    typeof username !== "string" ||
    username.length < 3 ||
    username.length > 50
  ) {
    return "Username must be between 3 and 50 characters";
  }
  if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
    return "Username can only contain letters, numbers, dots, and underscores";
  }
  return null;
}

export function validateEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? null
    : "Enter a valid email address";
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters";
  }
  // bcrypt only uses the first 72 bytes; reject instead of silently truncating.
  return Buffer.byteLength(password, "utf8") > 72
    ? "Password must not exceed 72 UTF-8 bytes"
    : null;
}

export function validateReview(score, comment) {
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score <= 0 ||
    score > 10
  ) {
    return "Score must be a number greater than 0 and at most 10";
  }
  if (comment != null && typeof comment !== "string")
    return "Comment must be text or null";
  return null;
}
