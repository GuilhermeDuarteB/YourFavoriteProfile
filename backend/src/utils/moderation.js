// Keep this list deliberately narrow. Ambiguous words and ethnicity names are
// excluded; this policy detects explicit terms, not intent or historical context.
const blockedTerms = [
  "nigger",
  "nigga",
  "wetback",
  "raghead",
  "towelhead",
  "porchmonkey",
  // Pejorative collectives, not ordinary Portuguese identity/ethnicity names.
  "pretalhada",
  "negralhada",
];

const substitutions = {
  a: "[a4@]",
  e: "[e3]",
  g: "[g69]",
  i: "[i1!|]",
  o: "[o0]",
  s: "[s5$]",
  t: "[t7+]",
};
// Separators cannot consume characters also used as letter substitutions. This
// avoids ambiguous nested repetition and limits matching across normal prose.
const separator = "(?:(?![!|@+$])[\\s\\p{P}\\p{S}]){0,3}";
const patterns = blockedTerms.map((term) => {
  const runs = term.match(/(.)\1*/g);
  const expression = runs
    .map((run) => {
      const character = substitutions[run[0]] || run[0];
      // Preserve required doubles: a country name with one g is not a slur.
      return `${character}(?:${separator}${character}){${run.length - 1},}`;
    })
    .join(separator);
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${expression}s?\\d*(?=$|[^\\p{L}\\p{N}])`,
    "u",
  );
});

// Accept complete chains of known terms, with outer word boundaries intact.
// Fixed-length term alternatives avoid nesting the stretched-letter repetitions
// above inside another unbounded repetition. Lookalikes and leetspeak still work.
const joinedTerms = blockedTerms
  .map((term) =>
    [...term].map((letter) => substitutions[letter] || letter).join(""),
  )
  .join("|");
const joinedPattern = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(?:${joinedTerms}){2,}s?\\d*(?=$|[^\\p{L}\\p{N}])`,
  "u",
);

function normalizedText(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .replace(/[\u0430\u03b1]/gu, "a")
    .replace(/[\u0435\u03b5]/gu, "e")
    .replace(/[\u0456\u03b9\u0131]/gu, "i")
    .replace(/[\u043e\u03bf]/gu, "o")
    .replace(/\u0261/gu, "g");
}

export function containsBlockedContent(value) {
  if (typeof value !== "string" || !value) return false;
  const normalized = normalizedText(value);
  return (
    patterns.some((pattern) => pattern.test(normalized)) ||
    joinedPattern.test(normalized)
  );
}

export function containsBlockedUsername(value) {
  if (containsBlockedContent(value)) return true;
  if (typeof value !== "string") return false;
  // Only common handle decorations, not arbitrary prefixes/suffixes. Prose and
  // media titles never use this username-specific boundary relaxation.
  const undecorated = normalizedText(value).replace(/^[x\d_.]+|[x\d_.]+$/g, "");
  return containsBlockedContent(undecorated);
}

export function isBlockedMedia(media) {
  if (!media || typeof media !== "object") return false;
  return [
    media.title,
    media.name,
    media.original_title,
    media.original_name,
  ].some(containsBlockedContent);
}

export function publicBio(value) {
  return typeof value === "string" && !containsBlockedContent(value)
    ? value
    : null;
}
