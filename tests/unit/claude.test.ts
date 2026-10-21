import { describe, expect, it } from 'vitest';
import { agentEnv, claudeArgs, deepseekCostUsd, isDeepseekModel } from '../../desk/claude.ts';

describe('isDeepseekModel', () => {
  it('knows the two DeepSeek models and nothing else', () => {
    expect(['deepseek-flash', 'deepseek-v4-pro', 'sonnet', 'opus'].map(isDeepseekModel)).toEqual([true, true, false, false]);
  });
});

describe('agentEnv', () => {
  const base = { PATH: '/usr/bin', ANTHROPIC_API_KEY: 'anthropic-key', HOME: '/h' };

  it('leaves the environment alone for a Claude model', () => {
    expect(agentEnv(base, 'sonnet', null)).toEqual(base);
  });

  it('points Claude Code at DeepSeek for a DeepSeek model, with every model slot set and the Anthropic key removed', () => {
    const env = agentEnv(base, 'deepseek-flash', 'ds-key');
    expect(env).toEqual({
      PATH: '/usr/bin',
      HOME: '/h',
      ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
      ANTHROPIC_AUTH_TOKEN: 'ds-key',
      ANTHROPIC_MODEL: 'deepseek-flash',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-flash',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-flash',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-flash',
      CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-flash',
    });
  });

  it('has no environment for a DeepSeek model without a key', () => {
    expect(agentEnv(base, 'deepseek-flash', null)).toBeNull();
  });
});

describe('deepseekCostUsd', () => {
  it('prices fresh input, cached input and output at the peak rates', () => {
    // Flash at peak: $0.30 per million fresh input, $0.006 cached, $1.20 output.
    const usage = { input_tokens: 1_000_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 1_000_000 };
    expect(deepseekCostUsd('deepseek-flash', usage)).toBeCloseTo(0.3 + 0.006 + 1.2, 10);
  });

  it('counts tokens written to the cache as fresh input', () => {
    expect(deepseekCostUsd('deepseek-flash', { input_tokens: 0, cache_creation_input_tokens: 1_000_000, output_tokens: 0 })).toBeCloseTo(0.3, 10);
  });

  it('has no cost when the usage is missing, so the call counts as possibly charged', () => {
    expect(deepseekCostUsd('deepseek-flash', undefined)).toBeNull();
  });
});

describe('claudeArgs', () => {
  it('caps a Claude run with Claude Code’s spending limit', () => {
    const args = claudeArgs('p', { capUsd: 0.4, model: 'sonnet', allowedTools: ['WebSearch'] });
    expect(args).toEqual(['-p', 'p', '--output-format', 'json', '--model', 'sonnet', '--max-budget-usd', '0.40', '--allowedTools', 'WebSearch']);
  });

  it('bounds a DeepSeek run by turns instead, since Claude Code misprices models it does not know', () => {
    const args = claudeArgs('p', { capUsd: 0.4, model: 'deepseek-flash' });
    expect(args).toContain('--max-turns');
    expect(args).not.toContain('--max-budget-usd');
  });
});
