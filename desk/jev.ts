/**
 * The door for metered Jev calls. Every call reserves its estimated cost against the run's
 * shared budget (desk/budget.ts) before it is sent, settles at what was charged after, and is
 * never sent twice when it may already have been charged. The API key is read from the
 * Keychain at the moment of each call and never printed, logged or passed on.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Budget } from './budget.ts';

const run = promisify(execFile);

/** Jev's price per input token in USD ($0.042 per million; output is free). Checked 2026-10-19 on docs.typesafe.ai/models. */
export const usdPerInputToken = 0.042 / 1_000_000;

export type JevAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; probabilities: Record<string, number>; confidence: number };

export type JevResult =
  | { ok: true; model: string; answers: Record<string, JevAnswer>; inputTokens: number }
  | { ok: false; reason: 'over-budget' | 'rejected' | 'possibly-charged' | 'no-key'; message: string };

export interface JevDoor {
  ask(state: unknown, questions: Record<string, unknown>): Promise<JevResult>;
  /** What this door's calls cost; the shared budget holds the run's total. */
  spentUsd(): number;
}

async function readKey(): Promise<string | null> {
  try {
    const { stdout } = await run('security', ['find-generic-password', '-s', 'typesafe.ai', '-a', 'api', '-w']);
    const key = stdout.trim();
    return key === '' ? null : key;
  } catch {
    return null;
  }
}

/** A rough upper estimate: JSON characters divided by three. Real usage replaces it after the call. */
export function estimateTokens(body: string): number {
  return Math.ceil(body.length / 3);
}

export function createJevDoor(options: { budget: Budget; model: string; sleep: (ms: number) => Promise<void> }): JevDoor {
  let spent = 0;
  return {
    spentUsd: () => spent,
    async ask(state, questions) {
      const body = JSON.stringify({ model: options.model, state, questions });
      const reservation = options.budget.reserve(estimateTokens(body) * usdPerInputToken);
      if (reservation === null) {
        return { ok: false, reason: 'over-budget', message: `would pass the $${options.budget.limitUsd.toFixed(2)} budget` };
      }
      const key = await readKey();
      if (key === null) {
        options.budget.settle(reservation, 0);
        return { ok: false, reason: 'no-key', message: 'no TypeSafe key in the Keychain (service typesafe.ai, account api)' };
      }
      // Only "too many requests" and "overloaded" are retried: those were not charged.
      for (let attempt = 0; ; attempt += 1) {
        let response: Response;
        try {
          response = await fetch('https://api.typesafe.ai/v1/systemone', {
            method: 'POST',
            headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
            body,
            signal: AbortSignal.timeout(60_000),
          });
        } catch (error) {
          // No answer: the call may have been charged, so it counts in full and is not resent.
          options.budget.possiblyCharged(reservation);
          spent += reservation.usd;
          return { ok: false, reason: 'possibly-charged', message: error instanceof Error ? error.message : String(error) };
        }
        if ((response.status === 429 || response.status === 529) && attempt < 5) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await options.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
          continue;
        }
        if (!response.ok) {
          options.budget.settle(reservation, 0);
          return { ok: false, reason: 'rejected', message: `HTTP ${String(response.status)}: ${(await response.text()).slice(0, 300)}` };
        }
        const parsed = (await response.json()) as { model: string; answers: Record<string, JevAnswer>; usage: { input_tokens: number } };
        const cost = parsed.usage.input_tokens * usdPerInputToken;
        options.budget.settle(reservation, cost);
        spent += cost;
        return { ok: true, model: parsed.model, answers: parsed.answers, inputTokens: parsed.usage.input_tokens };
      }
    },
  };
}
