import { describe, expect, it } from 'vitest';
import { redirectTarget } from '../../src/lib/hosts.ts';

describe('redirectTarget', () => {
  it('leaves the canonical host alone', () => {
    expect(redirectTarget('https://thedoormanfallacy.com/ledger')).toBeNull();
  });

  it.each([
    ['https://www.thedoormanfallacy.com/ledger/dnb-2026/?a=1', 'https://thedoormanfallacy.com/ledger/dnb-2026/?a=1'],
    ['https://doormanfallacy.com/', 'https://thedoormanfallacy.com/'],
    ['https://www.doormanfallacy.com/idea', 'https://thedoormanfallacy.com/idea'],
    ['https://doormanfallacy.com', 'https://thedoormanfallacy.com/'],
    ['https://example.org/anything?x=1&y=2#frag', 'https://thedoormanfallacy.com/anything?x=1&y=2'],
    ['https://WWW.DoormanFallacy.com/Idea', 'https://thedoormanfallacy.com/Idea'],
    ['https://doormanfallacy.com:8443/idea', 'https://thedoormanfallacy.com/idea'],
  ])('sends %s to the canonical host, keeping path and query', (from, to) => {
    expect(redirectTarget(from)).toBe(to);
  });

  it('sends plain http on the canonical host to https', () => {
    expect(redirectTarget('http://thedoormanfallacy.com/idea?x=1')).toBe('https://thedoormanfallacy.com/idea?x=1');
  });

  it.each(['http://localhost:8787/', 'http://127.0.0.1:41234/suggest', 'http://[::1]:8787/', 'https://localhost/'])(
    'leaves the local host %s alone',
    (url) => {
      expect(redirectTarget(url)).toBeNull();
    },
  );

  it('does not treat a lookalike host as the canonical one', () => {
    expect(redirectTarget('https://thedoormanfallacy.com.evil.example/')).toBe('https://thedoormanfallacy.com/');
    expect(redirectTarget('https://localhost.evil.example/')).toBe('https://thedoormanfallacy.com/');
  });

  it('returns null for a URL it cannot parse, so the caller can answer it', () => {
    expect(redirectTarget('not a url')).toBeNull();
  });
});
