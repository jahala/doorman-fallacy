import { cutoffs } from '../lib/limits.ts';

export interface RetentionReport {
  readonly unconfirmedSubscribers: number;
  readonly suggestionPeople: number;
  readonly seen: number;
  readonly runs: number;
  readonly rateHits: number;
}

/**
 * The daily job: deletes what has passed its time (docs/data-model.md#d1). One batch, so it runs as
 * one transaction. Logs the counts, which hold no personal data.
 */
export async function runRetention(db: D1Database, now: Date): Promise<RetentionReport> {
  const limit = cutoffs(now);
  const [unconfirmed, people, seen, runs, rateHits] = await db.batch([
    db.prepare('DELETE FROM subscribers WHERE confirmed_at IS NULL AND token_sent_at < ?1').bind(limit.unconfirmedBefore),
    db
      .prepare(
        `UPDATE suggestions SET name = NULL, email = NULL
         WHERE resolved_at IS NOT NULL AND resolved_at < ?1 AND (name IS NOT NULL OR email IS NOT NULL)`,
      )
      .bind(limit.suggestionPeopleBefore),
    db.prepare('DELETE FROM seen WHERE last_seen_at < ?1').bind(limit.seenBefore),
    db.prepare('DELETE FROM runs WHERE started_at < ?1').bind(limit.runsBefore),
    db.prepare('DELETE FROM rate_hits WHERE hit_at < ?1').bind(limit.rateHitsBefore),
  ]);
  const report: RetentionReport = {
    unconfirmedSubscribers: unconfirmed?.meta.changes ?? 0,
    suggestionPeople: people?.meta.changes ?? 0,
    seen: seen?.meta.changes ?? 0,
    runs: runs?.meta.changes ?? 0,
    rateHits: rateHits?.meta.changes ?? 0,
  };
  console.log(JSON.stringify({ job: 'retention', ...report }));
  return report;
}
