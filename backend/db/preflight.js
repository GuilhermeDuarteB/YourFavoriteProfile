export const CHECKS = {
  invalid_media_type:
    "SELECT id FROM public.media WHERE type NOT IN ('movie','series','game')",
  invalid_media_source:
    "SELECT id FROM public.media WHERE source NOT IN ('tmdb','rawg')",
  invalid_source_type:
    "SELECT id FROM public.media WHERE NOT ((source='tmdb' AND type IN ('movie','series')) OR (source='rawg' AND type='game'))",
  blank_external_id: "SELECT id FROM public.media WHERE BTRIM(external_id)=''",
  duplicate_media_identity:
    "SELECT external_id,source,type FROM public.media GROUP BY external_id,source,type HAVING COUNT(*)>1",
  duplicate_media_reviews:
    "SELECT user_id,media_id FROM public.reviews WHERE media_id IS NOT NULL GROUP BY user_id,media_id HAVING COUNT(*)>1",
  duplicate_episode_reviews:
    "SELECT user_id,episode_id FROM public.reviews WHERE episode_id IS NOT NULL GROUP BY user_id,episode_id HAVING COUNT(*)>1",
  invalid_review_target:
    "SELECT id FROM public.reviews WHERE (media_id IS NULL)=(episode_id IS NULL)",
  invalid_watchlist_status:
    "SELECT id FROM public.watchlist WHERE status NOT IN ('want_to_watch','watching','completed','dropped')",
  normalized_email_collisions:
    "SELECT LOWER(TRIM(email)) FROM public.users GROUP BY LOWER(TRIM(email)) HAVING COUNT(*)>1",
  case_insensitive_username_collisions:
    "SELECT LOWER(username) FROM public.users GROUP BY LOWER(username) HAVING COUNT(*)>1",
  nonpositive_scores: "SELECT id FROM public.reviews WHERE score<=0",
  excessive_scores: "SELECT id FROM public.reviews WHERE score>10",
};

export async function preflight(client) {
  const counts = {};
  for (const [name, sql] of Object.entries(CHECKS)) {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS count FROM (" + sql + ") violations",
    );
    counts[name] = rows[0].count;
  }
  const failures = Object.entries(counts).filter(([, count]) => count > 0);
  if (failures.length)
    throw new Error(
      "Preflight failed (no data repaired): " +
        failures.map(([name, count]) => name + "=" + count).join(", "),
    );
  return counts;
}
