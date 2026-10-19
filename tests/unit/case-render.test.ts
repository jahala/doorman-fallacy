import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { citedSentence, loadedWords, renderCase, type Draft, type SourceMaterial } from '../../desk/case-render.ts';

const sources: SourceMaterial[] = [
  {
    id: 'example-release',
    kind: 'primary',
    url: 'https://example.com/release',
    publisher: 'Example Bank',
    title: 'Example Bank changes its operations',
    published: '2026-10-06',
    archive: 'https://web.archive.org/web/20261006000000/https://example.com/release',
    sentences: [
      'Example Bank will reduce its workforce by around 400 full-time positions.',
      'AI agents now carry out parts of the know-your-customer work, the bank said.',
      'The bank said "AI is changing the way we work" in a statement.',
    ],
  },
  {
    id: 'example-news',
    kind: 'reporting',
    url: 'https://news.example.com/a',
    publisher: 'Example News',
    title: 'Bank to cut 400 roles',
    published: '2026-10-07',
    archive: 'https://web.archive.org/web/20261007000000/https://news.example.com/a',
    sentences: ['The cuts will be completed in the fourth quarter of 2026, the bank said.'],
  },
];

const draft: Draft = {
  company: 'Example Bank ASA',
  short: 'Example Bank',
  country: 'NO',
  area: 'Operations',
  change: '400 roles cut as AI agents take on tasks.',
  announced: '2026-10-06',
  headcount: 400,
  door: 'Know-your-customer checks',
  claims: [{ date: '2026-10-06', who: 'Example Bank', said: 'AI is changing how the bank works.', cite: 'example-release#3' }],
  missed: [{ function: 'judgment', evidence: 'AI agents carry out parts of the checks.', cite: 'example-release#2' }],
  updates: [{ date: '2026-10-06', status: 'too-early', summary: 'Bank announces 400 role reductions.', cite: 'example-release#1' }],
  body: {
    role: [
      [
        { text: 'The bank will reduce around 400 full-time positions.', cite: 'example-release#1' },
        { text: 'The bank said AI is changing how it works.', cite: 'example-release#3' },
      ],
    ],
    change: [
      [
        { text: 'AI agents carry out parts of the checks.', cite: 'example-release#2' },
        { text: 'The bank named the reduction in the same release.', cite: 'example-release#1' },
      ],
    ],
    next: [[{ text: 'The cuts are due by the end of 2026.', cite: 'example-news#1' }]],
    open: ['Do customers wait longer for checks?'],
  },
  watch: { queries: ['Example Bank AI'], signals: ['complaints'] },
};

describe('citedSentence', () => {
  it('finds the numbered sentence of a source', () => {
    expect(citedSentence('example-news#1', sources)).toEqual({
      ok: true,
      source: 'example-news',
      sentence: 'The cuts will be completed in the fourth quarter of 2026, the bank said.',
    });
  });

  it('refuses an unknown source or a number out of range', () => {
    expect(citedSentence('nope#1', sources).ok).toBe(false);
    expect(citedSentence('example-news#2', sources).ok).toBe(false);
    expect(citedSentence('example-news', sources).ok).toBe(false);
  });
});

describe('loadedWords', () => {
  it('finds loaded words regardless of case and form', () => {
    expect(loadedWords('The bank Slashed jobs in a brutal cull')).toEqual(['slashed', 'brutal', 'cull']);
    expect(loadedWords('The bank will reduce 400 roles')).toEqual([]);
  });
});

describe('renderCase', () => {
  const result = renderCase(draft, sources, '2026-10-19');
  const rendered = result.ok ? result.text : '';
  const [, frontText = '', body = ''] = rendered.split(/^---$/m);

  it('refuses a draft with a citation that resolves to nothing', () => {
    const broken = { ...draft, claims: [{ ...draft.claims[0], date: '2026-10-06', who: 'x', said: 'y', cite: 'example-news#9' }] };
    expect(renderCase(broken, sources, '2026-10-19')).toEqual({ ok: false, problems: ['example-news has no sentence 9'] });
  });
  const front = parse(frontText) as Record<string, unknown>;

  it('copies cited sentences in as quotes, never the draft text', () => {
    expect(front.updates).toEqual([
      {
        date: '2026-10-06',
        status: 'too-early',
        summary: 'Bank announces 400 role reductions.',
        sources: ['example-release'],
        quote: 'Example Bank will reduce its workforce by around 400 full-time positions.',
      },
    ]);
  });

  it('lists only cited sources, with their archive links', () => {
    const listed = front.sources as { id: string; archive: string }[];
    expect(listed.map((source) => source.id)).toEqual(['example-release', 'example-news']);
    expect(listed[0]?.archive).toContain('web.archive.org');
  });

  it('writes the four headings in order and a footnote per cited sentence', () => {
    const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual(['The role', 'The change', 'What happened next', 'Open questions']);
    expect(body).toContain('The bank will reduce around 400 full-time positions.[^example-release]');
    expect(body).toContain('AI agents carry out parts of the checks.[^example-release-3]');
    expect(body).toContain('The cuts are due by the end of 2026.[^example-news]');
    expect(body).toContain('The bank named the reduction in the same release.[^example-release]');
    expect(body).toContain('[^example-release]: "Example Bank will reduce its workforce by around 400 full-time positions."');
    expect(body).toContain('- Do customers wait longer for checks?');
  });

  it('turns straight double quotes inside a quote into curly ones so the quote stays one string', () => {
    expect(body).toContain('[^example-release-2]: "The bank said “AI is changing the way we work” in a statement."');
  });

  it('sets the review fields for a new case', () => {
    expect(front.lastChecked).toBe('2026-10-19');
    expect(front.corrections).toEqual([]);
    expect(front.suggestedBy).toBeNull();
    expect(front.related).toEqual([]);
    expect('nextReview' in front).toBe(false);
  });
});
