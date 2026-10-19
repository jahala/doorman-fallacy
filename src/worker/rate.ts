import { hexFromBytes } from '../lib/hex.ts';
import { rateRules, rateWindowStart, type RateKind } from '../lib/limits.ts';

async function keyFor(kind: RateKind, address: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${address}`));
  return hexFromBytes(new Uint8Array(digest));
}

/**
 * Counts one attempt for this visitor, unless they have used up the limit for this kind of form
 * in the window. Returns whether the attempt may go on. The count and the insert are one SQL
 * statement, so two requests arriving together cannot both take the last place.
 */
export async function takeRatePlace(db: D1Database, kind: RateKind, address: string, now: Date): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO rate_hits (key, hit_at)
       SELECT ?1, ?2
       WHERE (SELECT COUNT(*) FROM rate_hits WHERE key = ?1 AND hit_at > ?3) < ?4`,
    )
    .bind(await keyFor(kind, address), now.toISOString(), rateWindowStart(kind, now), rateRules[kind].limit)
    .run();
  return result.meta.changes === 1;
}
