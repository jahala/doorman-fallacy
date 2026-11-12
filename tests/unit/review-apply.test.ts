import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { readCase, type ReadCase } from '../../desk/case-file.ts';
import { renderCase, statementsOf, type SourceMaterial } from '../../desk/case-render.ts';
import { applyReview, dropCiting, emptyReview, parseReview, trimForLength, type Review } from '../../desk/review-apply.ts';
import { checkCaseText } from '../../scripts/check-cases.ts';

const text = readFileSync(path.resolve(import.meta.dirname, '../../src/content/cases/cba-2025.md'), 'utf8');

function cba(): ReadCase {
  const read = readCase(text);
  if (!read.ok) throw new Error(read.problems.join('; '));
  return read.value;
}

const news: SourceMaterial = {
  id: 'fsu-2026-11',
  kind: 'primary',
  url: 'https://fsunion.org.au/news/cba-call-centre',
  publisher: 'Finance Sector Union',
  title: 'CBA call centre staff report longer queues',
  published: '2026-11-02',
  archive: 'https://web.archive.org/web/20261103000000/https://fsunion.org.au/news/cba-call-centre',
  sentences: ['Members at CBA told the union that call queues had grown since the voice bot was introduced.', 'The union said it had raised the queues with the bank.'],
};

const today = '2026-11-16';

function rendered(review: Review): { text: string; front: Record<string, unknown> } {
  const read = cba();
  const applied = applyReview(read, review, [news], today);
  if (!applied.ok) throw new Error(applied.problems.join('; '));
  const out = renderCase(applied.draft, applied.sources, today, applied.record);
  if (!out.ok) throw new Error(out.problems.join('; '));
  const front = /^---\n([\s\S]*?)\n---/.exec(out.text)?.[1] ?? '';
  return { text: out.text, front: parse(front) as Record<string, unknown> };
}

describe('applyReview', () => {
  it('changes only the date of the check when the review found nothing', () => {
    const out = rendered(emptyReview);
    expect(out.text).toBe(text.replace('lastChecked: 2026-10-21', `lastChecked: ${today}`));
  });

  it('adds news after what the case already says, with its new source and footnote', () => {
    const out = rendered({
      ...emptyReview,
      add: {
        claims: [],
        missed: [{ function: 'slack', evidence: 'Members said call queues had grown since the voice bot was introduced.', cite: 'fsu-2026-11#1' }],
        updates: [{ date: '2026-11-02', status: 'strained', summary: 'The union said call queues had grown since the voice bot.', cite: 'fsu-2026-11#1' }],
        body: { role: [], change: [], next: [[{ text: 'The union said members reported longer call queues.', cite: 'fsu-2026-11#1' }]] },
      },
    });
    expect(checkCaseText('cba-2025.md', out.text)).toEqual([]);
    expect(out.text).toContain('CBA said it was also reviewing its internal processes.[^acs-reversal-6]\n\nThe union said members reported longer call queues.[^fsu-2026-11]');
    expect((out.front['updates'] as { status: string }[]).map((update) => update.status)).toEqual(['too-early', 'reversed', 'strained']);
    expect((out.front['sources'] as { id: string }[]).map((source) => source.id)).toContain('fsu-2026-11');
    expect(out.front['corrections']).toEqual([]);
  });

  it('keeps updates oldest first when the news is about an earlier date', () => {
    const out = rendered({
      ...emptyReview,
      add: { claims: [], missed: [], updates: [{ date: '2025-08-01', status: 'too-early', summary: 'The union raised the cuts with the bank.', cite: 'fsu-2026-11#2' }], body: { role: [], change: [], next: [] } },
    });
    expect((out.front['updates'] as { date: string }[]).map((update) => update.date)).toEqual(['2025-07-29', '2025-08-01', '2025-08-21']);
  });

  it('records a correction, in its own words, when it removes a sentence its source did not support', () => {
    const out = rendered({ ...emptyReview, remove: [{ place: 'next[2][0]', reason: 'not-supported' }] });
    const body = out.text.slice(out.text.indexOf('## The role'));
    expect(body).not.toContain('CBA said it was also reviewing its internal processes.');
    expect(out.front['corrections']).toEqual([{ date: today, what: 'Removed a sentence its source did not support: "CBA said it was also reviewing its internal processes."' }]);
    // The footnote it alone used goes too.
    expect(out.text).not.toContain('[^acs-reversal-6]');
  });

  it('records no correction when a sentence makes way for news or for length', () => {
    const out = rendered({ ...emptyReview, remove: [{ place: 'next[2][0]', reason: 'superseded' }] });
    expect(out.front['corrections']).toEqual([]);
  });

  it('corrects a field and says so when the field was wrong, and only then', () => {
    const wrong = rendered({ ...emptyReview, fields: [{ field: 'headcount', value: 40, reason: 'error' }] });
    expect(wrong.front['headcount']).toBe(40);
    expect(wrong.front['corrections']).toEqual([{ date: today, what: 'Corrected the number of roles from 45 to 40.' }]);
    const updated = rendered({ ...emptyReview, fields: [{ field: 'change', value: '45 roles cut for a voice bot; later reversed.', reason: 'news' }] });
    expect(updated.front['change']).toBe('45 roles cut for a voice bot; later reversed.');
    expect(updated.front['corrections']).toEqual([]);
  });

  it('replaces the open questions only when the review gives new ones', () => {
    expect(rendered({ ...emptyReview, open: ['Did call queues fall after the reversal?'] }).text).toContain('## Open questions\n\n- Did call queues fall after the reversal?\n\n[^');
  });

  it('refuses a removal at a place the case does not have', () => {
    const applied = applyReview(cba(), { ...emptyReview, remove: [{ place: 'next[9][0]', reason: 'superseded' }] }, [news], today);
    expect(applied.ok).toBe(false);
  });

  it('refuses a review that would leave a section or the updates empty', () => {
    const role = applyReview(cba(), { ...emptyReview, remove: [{ place: 'role[0][0]', reason: 'superseded' }, { place: 'role[0][1]', reason: 'superseded' }] }, [news], today);
    expect(role.ok).toBe(false);
    const updates = applyReview(cba(), { ...emptyReview, remove: [{ place: 'updates[0]', reason: 'superseded' }, { place: 'updates[1]', reason: 'superseded' }] }, [news], today);
    expect(updates.ok).toBe(false);
  });

  it('refuses a review that makes the body longer than the limit', () => {
    const many = Array.from({ length: 6 }, () => [{ text: 'The union said members reported longer call queues.', cite: 'fsu-2026-11#1' }]);
    const applied = applyReview(cba(), { ...emptyReview, add: { claims: [], missed: [], updates: [], body: { role: [], change: [], next: many } } }, [news], today);
    expect(applied.ok).toBe(false);
  });

  it('refuses a removal for length when the case is within the limit', () => {
    const applied = applyReview(cba(), { ...emptyReview, remove: [{ place: 'next[2][0]', reason: 'length' }] }, [news], today);
    expect(applied.ok).toBe(false);
  });

  it('refuses to mark a report corrected when the review corrected nothing', () => {
    const applied = applyReview(cba(), { ...emptyReview, reports: [{ id: 4, outcome: 'corrected', reason: 'The headcount was wrong.' }] }, [news], today);
    expect(applied.ok).toBe(false);
  });
});

describe('a removal that leaves the rest hanging', () => {
  const telenor = readFileSync(path.resolve(import.meta.dirname, '../../src/content/cases/telenor-2024.md'), 'utf8');
  function telenorCase(): ReadCase {
    const read = readCase(telenor);
    if (!read.ok) throw new Error(read.problems.join('; '));
    return read.value;
  }
  const place = (start: string): string => {
    const found = statementsOf(telenorCase().draft).find((item) => item.text.startsWith(start));
    if (found === undefined) throw new Error(`no statement starts "${start}"`);
    return found.where;
  };

  it('is refused when a kept sentence names a person introduced only in a removed one', () => {
    const applied = applyReview(telenorCase(), { ...emptyReview, remove: [{ place: place('The managing director of Telenor Norge'), reason: 'length' }] }, [], today);
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.problems.join(' ')).toContain('Engebretsen');
  });

  it('is refused when a kept sentence leans on the removed one before it', () => {
    const applied = applyReview(telenorCase(), { ...emptyReview, remove: [{ place: place('Telenor described artificial intelligence'), reason: 'length' }] }, [], today);
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.problems.join(' ')).toContain('this would also reduce');
  });

  it('is allowed when the person goes with every sentence that names them', () => {
    const remove = [
      { place: place('Kenneth Pettersen was'), reason: 'length' as const },
      { place: place('He said the union had worked'), reason: 'length' as const },
    ];
    const applied = applyReview(telenorCase(), { ...emptyReview, remove }, [], today);
    // Still over the length limit; what matters here is that nothing is left hanging.
    expect(applied.ok ? [] : applied.problems.filter((problem) => !problem.startsWith('the body would hold'))).toEqual([]);
  });
});

describe('trimForLength', () => {
  const telenor = readFileSync(path.resolve(import.meta.dirname, '../../src/content/cases/telenor-2024.md'), 'utf8');
  const read = readCase(telenor);
  if (!read.ok) throw new Error(read.problems.join('; '));
  const { draft } = read.value;
  const body = statementsOf(draft).filter((item) => /^(role|change|next)\[/.test(item.where));
  const place = (start: string): string => body.find((item) => item.text.startsWith(start))?.where ?? '';

  it('removes the statements a reader needs least until the body fits, and only as many as it must', () => {
    // 19 statements; two added would make 21, so six must go.
    const needed = new Map(body.map((item, index) => [item.where, 0.5 + index / 100]));
    for (const start of ['Kenneth Pettersen was', 'He said the union had worked', 'According to Telenor', 'The office had 78']) needed.set(place(start), 0.01);
    const trimmed = trimForLength(draft, new Set(), 2, needed, 15);
    if (!trimmed.ok) throw new Error(trimmed.problem);
    expect(trimmed.places.size).toBe(6);
    for (const start of ['Kenneth Pettersen was', 'He said the union had worked', 'According to Telenor', 'The office had 78']) expect(trimmed.places.has(place(start))).toBe(true);
  });

  it('never leaves a name or a "this" hanging, even when the check rates it low', () => {
    const needed = new Map(body.map((item) => [item.where, 0.9]));
    needed.set(place('The managing director of Telenor Norge'), 0.01);
    needed.set(place('Telenor described artificial intelligence'), 0.02);
    const trimmed = trimForLength(draft, new Set(), 0, needed, 15);
    if (!trimmed.ok) throw new Error(trimmed.problem);
    expect(trimmed.places.has(place('The managing director of Telenor Norge'))).toBe(false);
    expect(trimmed.places.has(place('Telenor described artificial intelligence'))).toBe(false);
  });

  it('keeps at least one statement in every section', () => {
    const plain = (text: string): { text: string; cite: string } => ({ text, cite: 'acs-reversal#1' });
    const base = cba().draft;
    const short = { ...base, body: { ...base.body, role: [[plain('the roles were in a call centre.'), plain('the centre took calls.')]], change: [[plain('the bank cut the roles.')]], next: [[plain('the bank later kept the roles.')]] } };
    const needed = new Map([['role[0][0]', 0.01], ['role[0][1]', 0.02], ['change[0][0]', 0.9], ['next[0][0]', 0.9]]);
    // Four statements and one added, with room for three: two must go, and the role keeps one.
    const trimmed = trimForLength(short, new Set(), 1, needed, 3);
    expect(trimmed.ok).toBe(false);
    const roomier = trimForLength(short, new Set(), 0, needed, 3);
    expect(roomier).toEqual({ ok: true, places: new Set(['role[0][0]']) });
  });

  it('removes nothing from a body within the limit', () => {
    const trimmed = trimForLength(draft, new Set(), 0, new Map(), 30);
    expect(trimmed).toEqual({ ok: true, places: new Set() });
  });
});

describe('dropCiting', () => {
  it('removes every addition that cites the given sources, and nothing else', () => {
    const parts = {
      claims: [],
      missed: [],
      updates: [{ date: '2026-11-02', status: 'strained', summary: 'Queues grew.', cite: 'fsu-2026-11#1' }],
      body: { role: [], change: [], next: [[{ text: 'A.', cite: 'fsu-2026-11#2' }, { text: 'B.', cite: 'acs-reversal#1' }]] },
    };
    const dropped = dropCiting(parts, new Set(['fsu-2026-11']));
    expect(dropped.updates).toEqual([]);
    expect(dropped.body.next).toEqual([[{ text: 'B.', cite: 'acs-reversal#1' }]]);
  });
});

describe('parseReview', () => {
  it('reads a well-formed answer', () => {
    const parsed = parseReview({ ...emptyReview, kinds: { 'fsu-2026-11': 'primary' } });
    expect(parsed.ok).toBe(true);
  });

  it('refuses an answer with an unknown removal reason or field', () => {
    expect(parseReview({ ...emptyReview, remove: [{ place: 'next[0][0]', reason: 'dislike' }] }).ok).toBe(false);
    expect(parseReview({ ...emptyReview, fields: [{ field: 'company', value: 'X', reason: 'error' }] }).ok).toBe(false);
  });
});
