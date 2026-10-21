import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { caseSchema, citedSourceIds } from '../src/data/case-schema.ts';
import { quoteLongEnough } from '../src/lib/quotes.ts';

/**
 * The mechanical publishing checks for case files (docs/engineering.md, "Publishing checks", 1):
 * the schema, the body's headings, and the footnotes that tie each sentence to a source.
 * checkCaseText is pure; checkCases and the command at the bottom do the file reading.
 */

/** The only `##` headings a case body has, in this order. */
export const requiredHeadings = [
  '## The role',
  '## The change',
  '## What happened next',
  '## Open questions',
] as const;

/** The section where every paragraph must carry a footnote. */
const factsHeading = '## What happened next';

export type CaseRule =
  | 'folder'
  | 'front-matter'
  | 'schema'
  | 'heading-extra'
  | 'heading-missing'
  | 'heading-order'
  | 'footnote-unknown-source'
  | 'footnote-undefined'
  | 'footnote-duplicate'
  | 'footnote-no-quote'
  | 'paragraph-no-footnote'
  | 'source-uncited'
  | 'archive-other-site';

export interface CaseFinding {
  readonly file: string;
  /** 1-based; 0 when the finding is about the file as a whole. */
  readonly line: number;
  readonly rule: CaseRule;
  readonly message: string;
}

/**
 * The source id a footnote label stands for. A label is a source id, or a source id followed by
 * -n (a positive integer) so one source can back several sentences, each with its own quote:
 * [^dnb-release] and [^dnb-release-2]. The exact id is tried first, since ids may end in a
 * number themselves (acs-2025-08); only then is one trailing -n removed.
 */
export function resolveFootnoteLabel(label: string, sourceIds: ReadonlySet<string>): string | undefined {
  if (sourceIds.has(label)) return label;
  const stripped = /^(.+)-[1-9]\d*$/.exec(label)?.[1];
  return stripped !== undefined && sourceIds.has(stripped) ? stripped : undefined;
}

interface Split {
  readonly frontMatter: string;
  readonly body: string;
  /** The 1-based line of the first body line. */
  readonly bodyStartLine: number;
}

function splitFrontMatter(text: string): Split | undefined {
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (match?.[1] === undefined) return undefined;
  return {
    frontMatter: match[1],
    body: text.slice(match[0].length),
    bodyStartLine: text.slice(0, match[0].length).split('\n').length,
  };
}

interface BodyLine {
  readonly number: number;
  readonly text: string;
}

/** Body lines outside fenced code blocks, which hold sketches, not headings or footnotes. */
function unfencedLines(body: string, bodyStartLine: number): BodyLine[] {
  const lines: BodyLine[] = [];
  let inFence = false;
  body.split('\n').forEach((text, index) => {
    if (/^\s*(```|~~~)/.test(text)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) lines.push({ number: bodyStartLine + index, text });
  });
  return lines;
}

interface Definition {
  readonly label: string;
  readonly line: number;
  readonly text: string;
}

const definitionStart = /^\[\^([^\]\s]+)\]:\s*(.*)$/;
const referencePattern = /\[\^([^\]\s]+)\]/g;

/** Footnote definitions, each with its indented continuation lines, and the line numbers they cover. */
function readDefinitions(lines: readonly BodyLine[]): { definitions: Definition[]; covered: Set<number> } {
  const definitions: Definition[] = [];
  const covered = new Set<number>();
  let open: { label: string; line: number; parts: string[] } | undefined;
  const close = (): void => {
    if (open !== undefined) definitions.push({ label: open.label, line: open.line, text: open.parts.join(' ') });
    open = undefined;
  };
  for (const { number, text } of lines) {
    const start = definitionStart.exec(text);
    if (start?.[1] !== undefined) {
      close();
      open = { label: start[1], line: number, parts: [start[2] ?? ''] };
      covered.add(number);
    } else if (open !== undefined && /^(\t| {2,})\S/.test(text)) {
      open.parts.push(text.trim());
      covered.add(number);
    } else {
      close();
    }
  }
  close();
  return { definitions, covered };
}

/** Quoted strings in a footnote, in straight or curly double quotation marks. */
function quotedStrings(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"|“([^”]+)”/g)].map((match) => match[1] ?? match[2] ?? '');
}

/** Source ids from front matter that may not have passed the schema. */
function rawSourceIds(raw: unknown): Set<string> {
  const ids = new Set<string>();
  if (typeof raw !== 'object' || raw === null || !('sources' in raw) || !Array.isArray(raw.sources)) return ids;
  for (const source of raw.sources as unknown[]) {
    if (typeof source === 'object' && source !== null && 'id' in source && typeof source.id === 'string') {
      ids.add(source.id);
    }
  }
  return ids;
}

function checkHeadings(file: string, lines: readonly BodyLine[]): CaseFinding[] {
  const findings: CaseFinding[] = [];
  const headings = lines.flatMap(({ number, text }) => {
    const match = /^## +(\S.*?)\s*$/.exec(text);
    return match?.[1] === undefined ? [] : [{ line: number, heading: `## ${match[1]}` }];
  });
  const allowed: readonly string[] = requiredHeadings;
  const known = headings.filter(({ heading }) => allowed.includes(heading));

  for (const { line, heading } of headings) {
    if (!allowed.includes(heading)) {
      findings.push({ file, line, rule: 'heading-extra', message: `Heading "${heading}" is not one of the four allowed headings` });
    }
  }
  const present = new Set(known.map(({ heading }) => heading));
  for (const heading of requiredHeadings) {
    if (!present.has(heading)) {
      findings.push({ file, line: 0, rule: 'heading-missing', message: `Missing heading "${heading}"` });
    }
  }
  const expected = requiredHeadings.filter((heading) => present.has(heading));
  const firstOff = known.findIndex(({ heading }, index) => heading !== expected[index]);
  if (firstOff !== -1 || known.length > expected.length) {
    const at = known[firstOff === -1 ? expected.length : firstOff];
    findings.push({
      file,
      line: at?.line ?? 0,
      rule: 'heading-order',
      message: `Headings must appear in this order, once each: ${requiredHeadings.join(', ')}`,
    });
  }
  return findings;
}

/** Each paragraph, or list item, under "What happened next" that has no footnote reference. */
function paragraphsWithoutFootnote(lines: readonly BodyLine[], covered: ReadonlySet<number>): number[] {
  const bare: number[] = [];
  let inSection = false;
  let unit: { line: number; text: string } | undefined;
  const close = (): void => {
    if (unit !== undefined && !/\[\^[^\]\s]+\]/.test(unit.text)) bare.push(unit.line);
    unit = undefined;
  };
  for (const { number, text } of lines) {
    const heading = /^#{1,6} /.test(text);
    if (heading) {
      close();
      inSection = text.trim() === factsHeading;
      continue;
    }
    if (!inSection || covered.has(number)) continue;
    if (text.trim() === '') {
      close();
      continue;
    }
    if (unit !== undefined && !/^\s*([-*+]|\d+[.)])\s/.test(text)) {
      unit.text += ` ${text}`;
    } else {
      close();
      unit = { line: number, text };
    }
  }
  close();
  return bare;
}

function checkBody(
  file: string,
  split: Split,
  sourceIds: ReadonlySet<string>,
): { findings: CaseFinding[]; cited: Set<string> } {
  const lines = unfencedLines(split.body, split.bodyStartLine);
  const { definitions, covered } = readDefinitions(lines);
  const findings = checkHeadings(file, lines);
  const cited = new Set<string>();

  const firstReference = new Map<string, number>();
  for (const { number, text } of lines) {
    if (covered.has(number)) continue;
    for (const match of text.matchAll(referencePattern)) {
      const label = match[1];
      if (label !== undefined && !firstReference.has(label)) firstReference.set(label, number);
    }
  }

  const defined = new Set<string>();
  for (const definition of definitions) {
    if (defined.has(definition.label)) {
      findings.push({
        file,
        line: definition.line,
        rule: 'footnote-duplicate',
        message: `Footnote [^${definition.label}] is defined more than once`,
      });
    }
    defined.add(definition.label);
    if (!quotedStrings(definition.text).some(quoteLongEnough)) {
      findings.push({
        file,
        line: definition.line,
        rule: 'footnote-no-quote',
        message: `Footnote [^${definition.label}] holds no quoted string of at least 4 words`,
      });
    }
  }

  for (const [label, line] of firstReference) {
    const id = resolveFootnoteLabel(label, sourceIds);
    if (id === undefined) {
      findings.push({ file, line, rule: 'footnote-unknown-source', message: `Footnote [^${label}] matches no source id` });
    } else {
      cited.add(id);
    }
    if (!defined.has(label)) {
      findings.push({ file, line, rule: 'footnote-undefined', message: `Footnote [^${label}] is used but never defined` });
    }
  }

  for (const line of paragraphsWithoutFootnote(lines, covered)) {
    findings.push({
      file,
      line,
      rule: 'paragraph-no-footnote',
      message: 'Paragraph under "What happened next" has no footnote reference',
    });
  }
  return { findings, cited };
}

/** All findings for one case file's text. `file` is only a label for the findings. */
export function checkCaseText(file: string, text: string): CaseFinding[] {
  const split = splitFrontMatter(text);
  if (split === undefined) {
    return [{ file, line: 1, rule: 'front-matter', message: 'The file has no front matter between --- lines' }];
  }

  let raw: unknown;
  try {
    raw = parse(split.frontMatter);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split('\n')[0] : 'unreadable';
    return [{ file, line: 1, rule: 'front-matter', message: `Front matter is not valid YAML: ${reason ?? 'unreadable'}` }];
  }

  const findings: CaseFinding[] = [];
  const parsed = caseSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const where = issue.path.map(String).join('.');
      findings.push({ file, line: 0, rule: 'schema', message: where === '' ? issue.message : `${where}: ${issue.message}` });
    }
  }

  const sourceIds = parsed.success ? new Set(parsed.data.sources.map((source) => source.id)) : rawSourceIds(raw);
  const body = checkBody(file, split, sourceIds);
  findings.push(...body.findings);

  // The schema sees only the front matter, so "every source is cited" is decided here, with the body.
  if (parsed.success) {
    const cited = new Set([...citedSourceIds(parsed.data), ...body.cited]);
    for (const id of sourceIds) {
      if (!cited.has(id)) {
        findings.push({ file, line: 0, rule: 'source-uncited', message: `Source ${id} is cited nowhere` });
      }
    }
  }
  // An archived copy must be of the source's own site: Save Page Now can report a frame loaded with
  // the page, such as an analytics tag, as the page it saved (Dukaan, 2026-10-21).
  if (parsed.success) {
    for (const source of parsed.data.sources) {
      const saved = source.archive.replace(/^https:\/\/web\.archive\.org\/web\/[^/]+\//, '');
      if (siteOf(saved) !== siteOf(source.url)) {
        findings.push({ file, line: 0, rule: 'archive-other-site', message: `Source ${source.id} is archived from ${siteOf(saved) ?? saved}, not ${siteOf(source.url) ?? source.url}` });
      }
    }
  }
  return findings;
}

function siteOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Checks every .md file directly inside a cases folder. No files is a pass; no folder is a finding. */
export async function checkCases(folder: string): Promise<CaseFinding[]> {
  try {
    if (!(await stat(folder)).isDirectory()) throw new Error('not a folder');
  } catch {
    return [{ file: folder, line: 0, rule: 'folder', message: 'Cases folder does not exist' }];
  }
  const names = (await readdir(folder, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  const findings: CaseFinding[] = [];
  for (const name of names) {
    findings.push(...checkCaseText(name, await readFile(path.join(folder, name), 'utf8')));
  }
  return findings;
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '..');
  const folder = process.argv[2] ?? path.join(root, 'src/content/cases');
  const findings = await checkCases(folder);
  for (const finding of findings) {
    console.error(`${finding.file}:${String(finding.line)}: [${finding.rule}] ${finding.message}`);
  }
  if (findings.length > 0) process.exit(1);
  const count = (await readdir(folder)).filter((name) => name.endsWith('.md')).length;
  console.log(`check-cases: all pass (case files checked: ${String(count)})`);
}
