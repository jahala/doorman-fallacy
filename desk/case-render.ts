/**
 * Pure assembly of a case file from a draft. The drafting agent cites sentences by number;
 * this code copies each cited sentence in as the quote, numbers the footnotes, and writes the
 * front matter and body in the format of docs/data-model.md.
 */
import { stringify } from 'yaml';

export interface Statement {
  readonly text: string;
  readonly cite: string;
}

export interface Draft {
  readonly company: string;
  readonly short: string;
  readonly country: string;
  readonly area: string;
  readonly change: string;
  readonly announced: string;
  readonly headcount: number | null;
  readonly door: string;
  readonly claims: readonly { date: string; who: string; said: string; cite: string }[];
  readonly missed: readonly { function: string; evidence: string; cite: string }[];
  readonly updates: readonly { date: string; status: string; summary: string; cite: string }[];
  readonly body: {
    readonly role: readonly (readonly Statement[])[];
    readonly change: readonly (readonly Statement[])[];
    readonly next: readonly (readonly Statement[])[];
    readonly open: readonly string[];
  };
  readonly watch: { readonly queries: readonly string[]; readonly signals: readonly string[] };
}

export interface SourceMaterial {
  readonly id: string;
  readonly kind: 'primary' | 'reporting';
  readonly url: string;
  readonly publisher: string;
  readonly title: string;
  readonly published: string;
  readonly archive: string;
  readonly sentences: readonly string[];
}

export type Cited = { ok: true; source: string; sentence: string } | { ok: false; message: string };

/** Resolves "source-id#n" (n counts from 1) to the sentence it names. */
export function citedSentence(cite: string, sources: readonly SourceMaterial[]): Cited {
  const match = /^([a-z0-9-]+)#(\d+)$/.exec(cite.trim());
  if (match?.[1] === undefined || match[2] === undefined) return { ok: false, message: `"${cite}" is not written source-id#number` };
  const source = sources.find((candidate) => candidate.id === match[1]);
  if (source === undefined) return { ok: false, message: `no source "${match[1]}"` };
  const sentence = source.sentences[Number(match[2]) - 1];
  if (sentence === undefined) return { ok: false, message: `${source.id} has no sentence ${match[2]}` };
  return { ok: true, source: source.id, sentence };
}

const loaded = [
  'slash', 'slashed', 'slashes', 'slashing', 'axe', 'axed', 'axes', 'axing', 'gut', 'gutted', 'gutting', 'sweeping', 'brutal',
  'greedy', 'greed', 'botched', 'cull', 'culled', 'culling', 'purge', 'purged', 'decimated', 'ruthless', 'massacre',
  'bloodbath', 'callous', 'disastrous', 'fiasco', 'shameful',
];

/** Loaded words in a statement, in the order they appear. */
export function loadedWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) => loaded.includes(word));
}

/** Straight double quotes inside a quote become curly ones, so the footnote stays one quoted string. */
/**
 * A footnote wraps its source sentence in double quote marks, so a quotation inside that sentence
 * takes single marks: “‘We have apologised,’ a spokesperson said.” Straight double marks alternate
 * open and close; curly ones keep their side.
 */
export function nestQuotes(sentence: string): string {
  let open = true;
  return sentence.replace(/["“”]/g, (mark) => {
    if (mark === '“') return '‘';
    if (mark === '”') return '’';
    const nested = open ? '‘' : '’';
    open = !open;
    return nested;
  });
}

/** Lower case words joined by hyphens, with accents dropped rather than turned into hyphens ("Le Progrès" is le-progres). */
export function slugOf(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Every citation in a draft, so they can all be resolved before anything is rendered. */
export function allCites(draft: Draft): string[] {
  const sections = [...draft.body.role, ...draft.body.change, ...draft.body.next].flat();
  return [
    ...draft.claims.map((claim) => claim.cite),
    ...draft.missed.map((point) => point.cite),
    ...draft.updates.map((update) => update.cite),
    ...sections.map((statement) => statement.cite),
  ];
}

export type Rendered = { ok: true; text: string } | { ok: false; problems: string[] };

/** What a case keeps from its life on the ledger, which a first draft starts empty. */
export interface CaseRecord {
  readonly corrections: readonly { readonly date: string; readonly what: string }[];
  readonly suggestedBy: string | null;
  readonly related: readonly string[];
  /** An override of the derived review date; absent in most cases. */
  readonly nextReview?: string | null;
}

export const firstRecord: CaseRecord = { corrections: [], suggestedBy: null, related: [] };

/** The statements a draft or a review cites, each with its place: claims[0], next[1][2] and so on. */
export interface CitingParts {
  readonly claims: Draft['claims'];
  readonly missed: Draft['missed'];
  readonly updates: Draft['updates'];
  readonly body: Pick<Draft['body'], 'role' | 'change' | 'next'>;
}

export type BodySection = 'role' | 'change' | 'next';
export const bodySections: readonly BodySection[] = ['role', 'change', 'next'];

export function statementsOf(draft: CitingParts): { where: string; text: string; cite: string }[] {
  const body = (name: BodySection): { where: string; text: string; cite: string }[] =>
    draft.body[name].flatMap((paragraph, p) => paragraph.map((statement, s) => ({ where: `${name}[${String(p)}][${String(s)}]`, ...statement })));
  return [
    ...draft.claims.map((claim, index) => ({ where: `claims[${String(index)}]`, text: claim.said, cite: claim.cite })),
    ...draft.missed.map((point, index) => ({ where: `missed[${String(index)}]`, text: point.evidence, cite: point.cite })),
    ...draft.updates.map((update, index) => ({ where: `updates[${String(index)}]`, text: update.summary, cite: update.cite })),
    ...bodySections.flatMap(body),
  ];
}

/** The same statements without those at the given places. A paragraph left empty is dropped. */
export function withoutPlaces<T extends CitingParts>(draft: T, places: ReadonlySet<string>): T {
  const keep = (name: BodySection): Statement[][] =>
    draft.body[name]
      .map((paragraph, p) => paragraph.filter((_, s) => !places.has(`${name}[${String(p)}][${String(s)}]`)))
      .filter((paragraph) => paragraph.length > 0);
  return {
    ...draft,
    claims: draft.claims.filter((_, index) => !places.has(`claims[${String(index)}]`)),
    missed: draft.missed.filter((_, index) => !places.has(`missed[${String(index)}]`)),
    updates: draft.updates.filter((_, index) => !places.has(`updates[${String(index)}]`)),
    body: { ...draft.body, role: keep('role'), change: keep('change'), next: keep('next') },
  };
}

/** How many statements the body holds, across the role, the change and what happened next. */
export function bodyLength(draft: Pick<CitingParts, 'body'>): number {
  return bodySections.reduce((sum, name) => sum + draft.body[name].flat().length, 0);
}

export function renderCase(draft: Draft, sources: readonly SourceMaterial[], today: string, record: CaseRecord = firstRecord): Rendered {
  const problems = allCites(draft).flatMap((cite) => {
    const found = citedSentence(cite, sources);
    return found.ok ? [] : [found.message];
  });
  if (problems.length > 0) return { ok: false, problems };
  const cited = new Set<string>();
  const use = (cite: string): { source: string; sentence: string } => {
    const found = citedSentence(cite, sources);
    // Every cite was resolved above, so this branch cannot be taken.
    const resolved = found.ok ? found : { source: '', sentence: '' };
    cited.add(resolved.source);
    return resolved;
  };

  const claims = draft.claims.map((claim) => {
    const found = use(claim.cite);
    return { date: claim.date, who: claim.who, said: claim.said, source: found.source, quote: found.sentence };
  });
  const missed = draft.missed.map((point) => ({ function: point.function, evidence: point.evidence, sources: [use(point.cite).source] }));
  const updates = draft.updates.map((update) => {
    const found = use(update.cite);
    return { date: update.date, status: update.status, summary: update.summary, sources: [found.source], quote: found.sentence };
  });

  // Footnotes: one label per cited sentence; a source's first sentence takes its bare id, later ones -2, -3 and so on.
  const labels = new Map<string, string>();
  const perSource = new Map<string, number>();
  const footnotes: string[] = [];
  const label = (statement: Statement): string => {
    const found = use(statement.cite);
    const key = `${found.source}\u0000${found.sentence}`;
    const existing = labels.get(key);
    if (existing !== undefined) return existing;
    const count = (perSource.get(found.source) ?? 0) + 1;
    perSource.set(found.source, count);
    const name = count === 1 ? found.source : `${found.source}-${String(count)}`;
    labels.set(key, name);
    footnotes.push(`[^${name}]: "${nestQuotes(found.sentence)}"`);
    return name;
  };
  const paragraphs = (section: readonly (readonly Statement[])[]): string =>
    section.map((paragraph) => paragraph.map((statement) => `${statement.text}[^${label(statement)}]`).join(' ')).join('\n\n');

  const body = [
    '## The role',
    '',
    paragraphs(draft.body.role),
    '',
    '## The change',
    '',
    paragraphs(draft.body.change),
    '',
    '## What happened next',
    '',
    paragraphs(draft.body.next),
    '',
    '## Open questions',
    '',
    ...draft.body.open.map((question) => `- ${question}`),
    '',
    ...footnotes,
    '',
  ].join('\n');

  const front = {
    company: draft.company,
    short: draft.short,
    country: draft.country,
    area: draft.area,
    change: draft.change,
    announced: draft.announced,
    headcount: draft.headcount,
    door: draft.door,
    claims,
    missed,
    updates,
    corrections: record.corrections.map(({ date, what }) => ({ date, what })),
    suggestedBy: record.suggestedBy,
    lastChecked: today,
    ...(record.nextReview === undefined ? {} : { nextReview: record.nextReview }),
    watch: { queries: [...draft.watch.queries], signals: [...draft.watch.signals] },
    sources: sources
      .filter((source) => cited.has(source.id))
      .map(({ id, kind, url, publisher, title, published, archive }) => ({ id, kind, url, publisher, title, published, archive })),
    related: [...record.related],
  };

  return { ok: true, text: `---\n${stringify(front, { lineWidth: 0 })}---\n\n${body}` };
}
