/**
 * Reads a published case back into the drafting format, so a review can change it and render it
 * again with renderCase. New cases and reviewed ones share one renderer, and a case read back and
 * rendered again is the same file (tests/unit/case-file.test.ts holds this on every case).
 *
 * Each source's sentences are the quotes the case already holds from it, in the order they first
 * appear: the quote fields of claims and updates, then the footnotes. A review may cite them again.
 * Pure: text in, value out; anything the format does not allow comes back as a problem.
 */
import { parse } from 'yaml';
import { resolveFootnoteLabel } from '../scripts/check-cases.ts';
import type { CaseRecord, Draft, SourceMaterial, Statement } from './case-render.ts';

export interface ReadCase {
  readonly draft: Draft;
  readonly sources: SourceMaterial[];
  readonly record: CaseRecord;
  readonly lastChecked: string;
}

export type ReadResult = { ok: true; value: ReadCase } | { ok: false; problems: string[] };

interface Front {
  company: string;
  short: string;
  country: string;
  area: string;
  change: string;
  announced: string;
  headcount: number | null;
  door: string;
  claims: { date: string; who: string; said: string; source: string; quote: string }[];
  missed: { function: string; evidence: string; sources: string[] }[];
  updates: { date: string; status: string; summary: string; sources: string[]; quote: string }[];
  corrections: { date: string; what: string }[];
  suggestedBy: string | null;
  lastChecked: string;
  nextReview?: string | null;
  watch: { queries: string[]; signals: string[] };
  sources: { id: string; kind: 'primary' | 'reporting'; url: string; publisher: string; title: string; published: string; archive: string }[];
  related: string[];
}

const headings = { role: '## The role', change: '## The change', next: '## What happened next', open: '## Open questions' } as const;

export function readCase(text: string): ReadResult {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(text);
  if (match?.[1] === undefined || match[2] === undefined) return { ok: false, problems: ['no front matter between --- lines'] };
  let front: Front;
  try {
    front = parse(match[1]) as Front;
  } catch (error) {
    return { ok: false, problems: [`front matter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const problems: string[] = [];
  const ids = new Set(front.sources.map((source) => source.id));
  const sentences = new Map<string, string[]>(front.sources.map((source) => [source.id, []]));
  const addSentence = (id: string, sentence: string): void => {
    const list = sentences.get(id);
    if (list !== undefined && !list.includes(sentence)) list.push(sentence);
  };
  const cite = (id: string, sentence: string): string => `${id}#${String((sentences.get(id) ?? []).indexOf(sentence) + 1)}`;

  for (const claim of front.claims) addSentence(claim.source, claim.quote);
  for (const update of front.updates) {
    if (update.sources.length !== 1) problems.push(`update of ${update.date} cites ${String(update.sources.length)} sources; a case read back needs one`);
    addSentence(update.sources[0] ?? '', update.quote);
  }

  // The body: four sections in order, then the footnote definitions.
  const lines = match[2].split('\n');
  const at = (heading: string): number => lines.indexOf(heading);
  const starts = [at(headings.role), at(headings.change), at(headings.next), at(headings.open)];
  if (starts.some((start, index) => start < 0 || (index > 0 && start < (starts[index - 1] ?? 0)))) {
    return { ok: false, problems: [...problems, 'the body headings are missing or out of order'] };
  }
  const [roleAt = 0, changeAt = 0, nextAt = 0, openAt = 0] = starts;
  const firstFootnote = lines.findIndex((line, index) => index > openAt && line.startsWith('[^'));
  const footnotesAt = firstFootnote < 0 ? lines.length : firstFootnote;

  const definitions = new Map<string, string>();
  for (const line of lines.slice(footnotesAt)) {
    if (line === '') continue;
    const definition = /^\[\^([a-z0-9-]+)\]: "(.*)"$/.exec(line);
    if (definition?.[1] === undefined || definition[2] === undefined) {
      problems.push(`footnote line not read: ${line.slice(0, 80)}`);
      continue;
    }
    const id = resolveFootnoteLabel(definition[1], ids);
    if (id === undefined) problems.push(`footnote [^${definition[1]}] matches no source`);
    else addSentence(id, definition[2]);
    definitions.set(definition[1], definition[2]);
  }

  const section = (from: number, to: number, name: string): Statement[][] =>
    lines
      .slice(from + 1, to)
      .join('\n')
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph !== '')
      .map((paragraph) => {
        const parts = paragraph.split(/\[\^([a-z0-9-]+)\]/);
        const statements: Statement[] = [];
        for (let index = 0; index + 1 < parts.length; index += 2) {
          const label = parts[index + 1] ?? '';
          const id = resolveFootnoteLabel(label, ids);
          const sentence = definitions.get(label);
          if (id === undefined || sentence === undefined) problems.push(`${name}: footnote [^${label}] has no source or definition`);
          else statements.push({ text: (parts[index] ?? '').trim(), cite: cite(id, sentence) });
        }
        const rest = (parts.at(-1) ?? '').trim();
        if (rest !== '') problems.push(`${name}: text without a footnote: ${rest.slice(0, 80)}`);
        return statements;
      });

  const open = lines
    .slice(openAt + 1, footnotesAt)
    .filter((line) => line !== '')
    .flatMap((line) => {
      if (line.startsWith('- ')) return [line.slice(2)];
      problems.push(`open questions: line not read: ${line.slice(0, 80)}`);
      return [];
    });

  const missed = front.missed.map((point) => {
    const id = point.sources[0] ?? '';
    if (point.sources.length !== 1) problems.push(`a reading point cites ${String(point.sources.length)} sources; a case read back needs one`);
    if ((sentences.get(id) ?? []).length === 0) problems.push(`the reading point on ${point.function} cites ${id}, which holds no quote in the case`);
    return { function: point.function, evidence: point.evidence, cite: `${id}#1` };
  });

  const draft: Draft = {
    company: front.company,
    short: front.short,
    country: front.country,
    area: front.area,
    change: front.change,
    announced: front.announced,
    headcount: front.headcount,
    door: front.door,
    claims: front.claims.map((claim) => ({ date: claim.date, who: claim.who, said: claim.said, cite: cite(claim.source, claim.quote) })),
    missed,
    updates: front.updates.map((update) => ({ date: update.date, status: update.status, summary: update.summary, cite: cite(update.sources[0] ?? '', update.quote) })),
    body: {
      role: section(roleAt, changeAt, 'the role'),
      change: section(changeAt, nextAt, 'the change'),
      next: section(nextAt, openAt, 'what happened next'),
      open,
    },
    watch: front.watch,
  };
  if (problems.length > 0) return { ok: false, problems };

  const sources: SourceMaterial[] = front.sources.map((source) => ({ ...source, sentences: sentences.get(source.id) ?? [] }));
  const record: CaseRecord = {
    corrections: front.corrections,
    suggestedBy: front.suggestedBy,
    related: front.related,
    ...(front.nextReview === undefined ? {} : { nextReview: front.nextReview }),
  };
  return { ok: true, value: { draft, sources, record, lastChecked: front.lastChecked } };
}
