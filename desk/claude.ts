/**
 * The door for Claude Code runs. Each run reserves its cap (--max-budget-usd) against the
 * desk run's shared budget before it starts, settles at the cost Claude reports, and counts
 * in full when no cost came back. A run is never started twice for the same request. The
 * child process is tracked, so stopping the desk run stops it too.
 */
import type { Budget } from './budget.ts';
import { runTracked } from './processes.ts';

export type ClaudeResult = { ok: true; text: string; costUsd: number } | { ok: false; reason: 'over-budget' | 'failed'; message: string; costUsd: number };

interface Envelope {
  result?: string;
  total_cost_usd?: number;
  is_error?: boolean;
}

function parseEnvelope(stdout: string): Envelope | null {
  try {
    return JSON.parse(stdout) as Envelope;
  } catch {
    return null;
  }
}

export async function askClaude(
  prompt: string,
  options: { budget: Budget; capUsd: number; model: string; allowedTools?: readonly string[]; disallowedTools?: readonly string[]; timeoutMs?: number },
): Promise<ClaudeResult> {
  const reservation = options.budget.reserve(options.capUsd);
  if (reservation === null) {
    return { ok: false, reason: 'over-budget', message: `would pass the $${options.budget.limitUsd.toFixed(2)} budget`, costUsd: 0 };
  }
  const args = ['-p', prompt, '--output-format', 'json', '--model', options.model, '--max-budget-usd', options.capUsd.toFixed(2)];
  if (options.allowedTools !== undefined) args.push('--allowedTools', ...options.allowedTools);
  if (options.disallowedTools !== undefined) args.push('--disallowedTools', ...options.disallowedTools);
  const ran = await runTracked('claude', args, { timeoutMs: options.timeoutMs ?? 15 * 60_000 });
  const envelope = parseEnvelope(ran.stdout);
  if (envelope?.total_cost_usd === undefined) {
    options.budget.possiblyCharged(reservation);
    return { ok: false, reason: 'failed', message: ran.ok ? 'no cost in the reply' : ran.message, costUsd: reservation.usd };
  }
  options.budget.settle(reservation, envelope.total_cost_usd);
  if (!ran.ok || envelope.is_error === true) {
    return { ok: false, reason: 'failed', message: (envelope.result ?? (ran.ok ? '' : ran.message)).slice(-400), costUsd: envelope.total_cost_usd };
  }
  return { ok: true, text: envelope.result ?? '', costUsd: envelope.total_cost_usd };
}
