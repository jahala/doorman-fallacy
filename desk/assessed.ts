/**
 * The desk's memory of the organisations it has assessed, so the weekly run does not assess one
 * again within 30 days (docs/operations.md). Every assessment is remembered where it is made, in
 * desk/assess.ts, whether a weekly run or a backfill made it. Kept 180 days. Pure.
 */

export interface Assessed {
  readonly name: string;
  readonly date: string;
  readonly recommendation: string;
}

export const assessedPath = '.desk-runs/assessed.json';
export const keepAssessedDays = 180;
export const recentDays = 30;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** The memory with these assessments added and entries past the keeping time dropped. */
export function rememberAssessed(memory: readonly Assessed[], added: readonly Assessed[], today: string): Assessed[] {
  return [...memory, ...added].filter((entry) => daysBetween(entry.date, today) <= keepAssessedDays);
}

/** Names assessed in the last 30 days. */
export function recentlyAssessed(memory: readonly Assessed[], today: string): string[] {
  return memory.filter((entry) => daysBetween(entry.date, today) <= recentDays).map((entry) => entry.name);
}
