import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** Site copy has no em dashes; verbatim quotes keep their source's punctuation. Written as an escape so this file passes its own check. */
const EM_DASH = '\u2014';

export const copyTargets = [
  'src/content',
  'src/pages',
  'src/layouts',
  'src/components',
  'src/data',
] as const;

const textExtensions = new Set(['.md', '.mdx', '.astro', '.ts', '.json', '.html', '.txt', '.css']);

export interface CopyFinding {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

/**
 * A verbatim quote from a source keeps the source's punctuation, so it is not site copy: a case's
 * footnote ([^id]: "…") or a quote field in its front matter. Quotes are single lines in case files.
 */
function isVerbatimQuote(line: string): boolean {
  return /^\[\^[^\]]+\]: /.test(line) || /^\s*quote: /.test(line);
}

/** The 1-based line numbers that hold an em dash, outside verbatim quotes. */
export function findEmDashLines(text: string): number[] {
  const lines: number[] = [];
  text.split('\n').forEach((line, index) => {
    if (line.includes(EM_DASH) && !isVerbatimQuote(line)) lines.push(index + 1);
  });
  return lines;
}

async function filesUnder(target: string): Promise<string[] | undefined> {
  let info;
  try {
    info = await stat(target);
  } catch {
    return undefined;
  }
  if (info.isFile()) return [target];
  const entries = await readdir(target, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && textExtensions.has(path.extname(entry.name)))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** Scans each target (a folder or a file) for em dashes. A missing target is a finding too. */
export async function checkCopy(root: string, targets: readonly string[]): Promise<CopyFinding[]> {
  const findings: CopyFinding[] = [];
  for (const target of targets) {
    const absolute = path.resolve(root, target);
    const files = await filesUnder(absolute);
    if (files === undefined) {
      findings.push({ file: target, line: 0, message: 'Folder or file to scan does not exist' });
      continue;
    }
    for (const file of files) {
      const text = await readFile(file, 'utf8');
      for (const line of findEmDashLines(text)) {
        findings.push({
          file: path.relative(root, file),
          line,
          message: 'Em dash. Rewrite the sentence without it',
        });
      }
    }
  }
  return findings;
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '..');
  const given = process.argv.slice(2);
  const findings = await checkCopy(process.cwd(), given.length > 0 ? given : copyTargets.map((t) => path.join(root, t)));
  for (const finding of findings) {
    console.error(`${finding.file}:${String(finding.line)}: ${finding.message}`);
  }
  if (findings.length > 0) process.exit(1);
  console.log('check-copy: no em dashes in site copy');
}
