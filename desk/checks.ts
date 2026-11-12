/**
 * The publishing checks a case's statements must pass, shared by drafting (desk/draft.ts) and
 * reviewing (desk/review.ts), so a new case and an addition to an old one meet the same bar
 * (docs/engineering.md, "Publishing checks"). The I/O each needs (Jev, archived pages) comes in
 * as a parameter.
 */
import { quoteFound } from '../src/lib/quotes.ts';
import { hiddenFunctions, type HiddenFunctionId } from '../src/data/hidden-functions.ts';
import { citedSentence, loadedWords, statementsOf, type CitingParts, type SourceMaterial } from './case-render.ts';
import type { JevAnswer, JevDoor } from './jev.ts';
import { neededQuestion, readingQuestion, readingThreshold, statementQuestions, supportedThreshold } from './statement-check.ts';
import type { Draft } from './case-render.ts';

export interface Failure {
  readonly where: string;
  readonly text: string;
  readonly cite: string;
  readonly reason: string;
}

/** Check 3 for one statement: its cited sentence must support all of it, with no loaded words and no motive. */
export async function checkStatement(where: string, text: string, cite: string, sources: readonly SourceMaterial[], door: JevDoor): Promise<Failure | null> {
  const found = citedSentence(cite, sources);
  if (!found.ok) return { where, text, cite, reason: found.message };
  const words = loadedWords(text);
  if (words.length > 0) return { where, text, cite, reason: `loaded words: ${words.join(', ')}` };
  const source = sources.find((candidate) => candidate.id === found.source);
  const result = await door.ask(
    {
      statement: text,
      quote: found.sentence,
      source: {
        publisher: source?.publisher ?? '',
        published: source?.published ?? '',
        kind: source?.kind === 'primary' ? 'the organisation’s own statement or an official record' : 'a news report',
        title: source?.title ?? '',
      },
    },
    statementQuestions,
  );
  if (!result.ok) return { where, text, cite, reason: `check could not run: ${result.message}` };
  const supported = result.answers.supported as Extract<JevAnswer, { type: 'noul' }> | undefined;
  const motive = result.answers.motive as Extract<JevAnswer, { type: 'noul' }> | undefined;
  if (supported === undefined || supported.noul < supportedThreshold) return { where, text, cite, reason: `${notSupported} (p=${(supported?.noul ?? 0).toFixed(2)})` };
  if (motive !== undefined && motive.noul >= 0.5) return { where, text, cite, reason: `suggests a motive (p=${motive.noul.toFixed(2)})` };
  return null;
}

/** The start of the reason checkStatement gives when the sentence does not support the statement. */
export const notSupported = 'not supported by its sentence';

/** Check 3: each statement against its cited sentence (Jev, and loaded words), and each reading point for evidence of loss. */
export async function checkStatements(parts: CitingParts, sources: readonly SourceMaterial[], door: JevDoor): Promise<Failure[]> {
  /** A point of the doorman reading must report the work going missing, not only that it exists. */
  async function checkReading(where: string, kindId: string, text: string, cite: string): Promise<Failure | null> {
    const kind = hiddenFunctions[kindId as HiddenFunctionId] as (typeof hiddenFunctions)[HiddenFunctionId] | undefined;
    if (kind === undefined) return { where, text, cite, reason: `unknown hidden function ${kindId}` };
    const result = await door.ask({ kind: kind.label, meaning: kind.meaning, evidence: text }, readingQuestion);
    if (!result.ok) return { where, text, cite, reason: `check could not run: ${result.message}` };
    const missing = result.answers.missing as Extract<JevAnswer, { type: 'noul' }> | undefined;
    if (missing === undefined || missing.noul < readingThreshold) {
      return { where, text, cite, reason: `does not report this work going missing, only that it exists (p=${(missing?.noul ?? 0).toFixed(2)})` };
    }
    return null;
  }

  const checks = await Promise.all([
    ...statementsOf(parts).map((item) => checkStatement(item.where, item.text, item.cite, sources, door)),
    ...parts.missed.map((point, index) => checkReading(`missed[${String(index)}]`, point.function, point.evidence, point.cite)),
  ]);
  return checks.filter((failure): failure is Failure => failure !== null);
}

/**
 * Jev's probability that a reader needs each body statement, by place, for trimming a case to its
 * limit. A statement Jev could not rate is rated 1, so it is the last to go.
 */
export async function neededScores(draft: Draft, door: JevDoor): Promise<Map<string, number>> {
  const body = statementsOf(draft).filter((item) => /^(role|change|next)\[/.test(item.where));
  const scores = await Promise.all(
    body.map(async (item) => {
      const result = await door.ask({ organisation: draft.company, change: draft.change, door: draft.door, statement: item.text }, neededQuestion);
      const answer = result.ok ? (result.answers.needed as Extract<JevAnswer, { type: 'noul' }> | undefined) : undefined;
      return [item.where, answer?.noul ?? 1] as const;
    }),
  );
  return new Map(scores);
}

/** Check 5: one primary source, or two independent reports, among the sources the cites name. */
export function sourceRuleProblem(cites: readonly string[], sources: readonly SourceMaterial[]): string | null {
  const cited = sources.filter((source) => cites.some((cite) => cite.startsWith(`${source.id}#`)));
  const primaries = cited.filter((source) => source.kind === 'primary').length;
  const reports = new Set(cited.filter((source) => source.kind === 'reporting').map((source) => source.publisher)).size;
  return primaries === 0 && reports < 2 ? `sources: ${String(primaries)} primary and ${String(reports)} independent reports; one primary or two reports are needed` : null;
}

/** What check 2 found for one source: its archived copy could not be read, or these quotes are not on it. */
export interface ArchiveFinding {
  readonly source: string;
  readonly unreadable: boolean;
  readonly missing: readonly string[];
  readonly found: number;
}

/** The raw archived page, or null when it cannot be read. */
export type ReadArchive = (archive: string) => Promise<string | null>;

export const readWaybackRaw: ReadArchive = async (archive) =>
  fetch(archive.replace(/\/web\/(\d+)\//, '/web/$1id_/'), { signal: AbortSignal.timeout(60_000) })
    .then(async (response) => (response.ok ? response.text() : null))
    .catch(() => null);

/**
 * Check 2: every quote the cites name is found word for word on its source's archived copy.
 * Sources with no archive are left to the caller, which knows whether that is allowed.
 */
export async function archiveFindings(cites: readonly string[], sources: readonly SourceMaterial[], readArchive: ReadArchive): Promise<ArchiveFinding[]> {
  const findings: ArchiveFinding[] = [];
  for (const source of sources.filter((candidate) => candidate.archive !== '')) {
    const quotes = [...new Set(cites.filter((cite) => cite.startsWith(`${source.id}#`)))].flatMap((cite) => {
      const found = citedSentence(cite, sources);
      return found.ok ? [found.sentence] : [];
    });
    if (quotes.length === 0) continue;
    const raw = await readArchive(source.archive);
    if (raw === null) {
      findings.push({ source: source.id, unreadable: true, missing: quotes, found: 0 });
      continue;
    }
    const missing = quotes.filter((quote) => !quoteFound(quote, raw));
    findings.push({ source: source.id, unreadable: false, missing, found: quotes.length - missing.length });
  }
  return findings;
}
