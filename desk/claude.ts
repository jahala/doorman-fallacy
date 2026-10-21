/**
 * The door for Claude Code runs. Each run reserves its cap (--max-budget-usd) against the
 * desk run's shared budget before it starts, settles at the cost Claude reports, and counts
 * in full when no cost came back. A run is never started twice for the same request. The
 * child process is tracked, so stopping the desk run stops it too.
 *
 * A DeepSeek model runs the same Claude Code agent against DeepSeek's Anthropic-compatible API
 * (https://api-docs.deepseek.com/quick_start/pricing). Claude Code reports costs at Anthropic's
 * prices, so for DeepSeek the cost is worked out from the token counts at DeepSeek's peak rates.
 */
import type { Budget } from './budget.ts';
import { runTracked } from './processes.ts';

export type ClaudeResult = { ok: true; text: string; costUsd: number } | { ok: false; reason: 'over-budget' | 'failed'; message: string; costUsd: number };

export interface Usage {
  readonly input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly output_tokens?: number;
}

interface Envelope {
  result?: string;
  total_cost_usd?: number;
  is_error?: boolean;
  usage?: Usage;
}

/** Dollars per million tokens at peak, the higher of DeepSeek's two rates (checked 2026-10-21). */
const deepseekPrices = {
  'deepseek-flash': { fresh: 0.3, cached: 0.006, output: 1.2 },
  'deepseek-v4-pro': { fresh: 1.32, cached: 0.044, output: 3.96 },
} as const;

type DeepseekModel = keyof typeof deepseekPrices;

export function isDeepseekModel(model: string): model is DeepseekModel {
  return Object.hasOwn(deepseekPrices, model);
}

/** What a DeepSeek run cost, from its token counts. Null when Claude Code reported no usage. */
export function deepseekCostUsd(model: DeepseekModel, usage: Usage | undefined): number | null {
  if (usage === undefined) return null;
  const price = deepseekPrices[model];
  const fresh = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  return (fresh * price.fresh + (usage.cache_read_input_tokens ?? 0) * price.cached + (usage.output_tokens ?? 0) * price.output) / 1_000_000;
}

/**
 * The environment a Claude Code run gets. A Claude model keeps the desk's own; a DeepSeek model
 * points every model slot at DeepSeek and drops the Anthropic key. Null when DeepSeek has no key.
 */
export function agentEnv(base: NodeJS.ProcessEnv, model: string, deepseekKey: string | null): NodeJS.ProcessEnv | null {
  if (!isDeepseekModel(model)) return base;
  if (deepseekKey === null) return null;
  const rest = Object.fromEntries(Object.entries(base).filter(([name]) => name !== 'ANTHROPIC_API_KEY'));
  return {
    ...rest,
    ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
    ANTHROPIC_AUTH_TOKEN: deepseekKey,
    ANTHROPIC_MODEL: model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
    CLAUDE_CODE_SUBAGENT_MODEL: model,
  };
}

function parseEnvelope(stdout: string): Envelope | null {
  try {
    return JSON.parse(stdout) as Envelope;
  } catch {
    return null;
  }
}

/** Turns a DeepSeek run may take. Claude Code's spending cap cannot bound it (see claudeArgs). */
const deepseekMaxTurns = 40;

/**
 * The Claude Code command line. A Claude run is capped by Claude Code's own spending limit. Claude
 * Code prices a model it does not know at its own fallback rate, which stops a DeepSeek run at once
 * ("Reply ok" was costed at $0.09), so a DeepSeek run is bounded by turns and by the time limit;
 * its cap is still reserved against the shared budget before it starts.
 */
export function claudeArgs(
  prompt: string,
  options: { capUsd: number; model: string; allowedTools?: readonly string[]; disallowedTools?: readonly string[] },
): string[] {
  const args = ['-p', prompt, '--output-format', 'json', '--model', options.model];
  if (isDeepseekModel(options.model)) args.push('--max-turns', String(deepseekMaxTurns));
  else args.push('--max-budget-usd', options.capUsd.toFixed(2));
  if (options.allowedTools !== undefined) args.push('--allowedTools', ...options.allowedTools);
  if (options.disallowedTools !== undefined) args.push('--disallowedTools', ...options.disallowedTools);
  return args;
}

export async function askClaude(
  prompt: string,
  options: {
    budget: Budget;
    capUsd: number;
    model: string;
    allowedTools?: readonly string[];
    disallowedTools?: readonly string[];
    timeoutMs?: number;
    /** Needed for a DeepSeek model. */
    deepseekKey?: string | null;
  },
): Promise<ClaudeResult> {
  const env = agentEnv(process.env, options.model, options.deepseekKey ?? null);
  if (env === null) return { ok: false, reason: 'failed', message: `${options.model} needs DEEPSEEK_API_KEY`, costUsd: 0 };
  const reservation = options.budget.reserve(options.capUsd);
  if (reservation === null) {
    return { ok: false, reason: 'over-budget', message: `would pass the $${options.budget.limitUsd.toFixed(2)} budget`, costUsd: 0 };
  }
  const args = claudeArgs(prompt, options);
  const ran = await runTracked('claude', args, { timeoutMs: options.timeoutMs ?? 15 * 60_000, env });
  const envelope = parseEnvelope(ran.stdout);
  const cost = envelope === null ? null : isDeepseekModel(options.model) ? deepseekCostUsd(options.model, envelope.usage) : (envelope.total_cost_usd ?? null);
  if (envelope === null || cost === null) {
    options.budget.possiblyCharged(reservation);
    return { ok: false, reason: 'failed', message: ran.ok ? 'no cost in the reply' : ran.message, costUsd: reservation.usd };
  }
  options.budget.settle(reservation, cost);
  if (!ran.ok || envelope.is_error === true) {
    return { ok: false, reason: 'failed', message: (envelope.result ?? (ran.ok ? '' : ran.message)).slice(-400), costUsd: cost };
  }
  return { ok: true, text: envelope.result ?? '', costUsd: cost };
}
