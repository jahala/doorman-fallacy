import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const briefName = 'CLAUDE.md';
export const briefMaxLines = 150;

/**
 * Paths the docs describe that no file exists for yet. This is a visible, explicit list.
 * Each entry leaves the list in the change that creates the file; the check fails on an
 * entry whose path now exists, so the list can only shrink.
 */
export const notYetBuilt: readonly string[] = [
  // The weekly review job (docs/operations.md). It lands with the ledger, not with the scaffold.
  'scripts/review-due',
];

const repoPathPattern = /^(src|docs|scripts|tests|public)\//;

export interface DocFinding {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface PathReference {
  readonly line: number;
  readonly kind: 'link' | 'code';
  readonly target: string;
}

/** Fenced code blocks hold sketches, not references, so their lines are blanked and numbering is kept. */
function withoutFences(markdown: string): string[] {
  let inFence = false;
  return markdown.split('\n').map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return '';
    }
    return inFence ? '' : line;
  });
}

/** Relative links, and backticked names that start with a repo folder. */
export function extractPathReferences(markdown: string): PathReference[] {
  const references: PathReference[] = [];
  withoutFences(markdown).forEach((line, index) => {
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const raw = match[1];
      if (raw === undefined || /^([a-z][a-z0-9+.-]*:|#)/i.test(raw)) continue;
      const target = raw.split('#')[0];
      if (target !== undefined && target !== '') {
        references.push({ line: index + 1, kind: 'link', target });
      }
    }
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const raw = match[1]?.trim();
      if (raw === undefined || !repoPathPattern.test(raw) || /[\s<>{}]/.test(raw)) continue;
      references.push({ line: index + 1, kind: 'code', target: raw });
    }
  });
  return references;
}

async function exists(absolute: string): Promise<boolean> {
  try {
    await access(absolute);
    return true;
  } catch {
    return false;
  }
}

/**
 * A path exists when the file or folder does, or when it is written without an extension
 * and a file of that name with some extension does (scripts/check-docs for check-docs.ts).
 * A wildcard path is checked up to its first wildcard.
 */
export async function repoPathExists(root: string, repoPath: string): Promise<boolean> {
  const firstWildcard = repoPath.indexOf('*');
  const literal = firstWildcard === -1 ? repoPath : repoPath.slice(0, firstWildcard);
  const absolute = path.resolve(root, literal);
  if (await exists(absolute)) return true;
  if (firstWildcard !== -1 || literal.endsWith('/')) return false;
  try {
    const siblings = await readdir(path.dirname(absolute));
    const base = path.basename(absolute);
    return siblings.some((name) => name.startsWith(`${base}.`));
  } catch {
    return false;
  }
}

/** Findings for one document. `pending` paths are tolerated while they do not exist. */
export async function checkDocFile(
  root: string,
  file: string,
  pending: readonly string[],
): Promise<DocFinding[]> {
  const markdown = await readFile(file, 'utf8');
  const relativeFile = path.relative(root, file);
  const findings: DocFinding[] = [];
  for (const reference of extractPathReferences(markdown)) {
    const repoPath =
      reference.kind === 'link'
        ? path.relative(root, path.resolve(path.dirname(file), reference.target))
        : reference.target;
    if (pending.includes(repoPath)) continue;
    if (!(await repoPathExists(root, repoPath))) {
      findings.push({
        file: relativeFile,
        line: reference.line,
        message: `${reference.kind === 'link' ? 'Link' : 'Path'} points at ${repoPath}, which does not exist`,
      });
    }
  }
  return findings;
}

export function checkBriefLength(markdown: string): DocFinding[] {
  const lines = markdown.endsWith('\n') ? markdown.split('\n').length - 1 : markdown.split('\n').length;
  return lines > briefMaxLines
    ? [{ file: briefName, line: lines, message: `${briefName} has ${String(lines)} lines; the limit is ${String(briefMaxLines)}` }]
    : [];
}

/** Allowlist entries that now exist must be removed from the list. */
export async function checkPending(root: string, pending: readonly string[]): Promise<DocFinding[]> {
  const findings: DocFinding[] = [];
  for (const entry of pending) {
    if (await repoPathExists(root, entry)) {
      findings.push({
        file: 'scripts/check-docs.ts',
        line: 0,
        message: `${entry} now exists; remove it from notYetBuilt`,
      });
    }
  }
  return findings;
}

export async function checkDocs(root: string, pending: readonly string[]): Promise<DocFinding[]> {
  const docsDir = path.join(root, 'docs');
  const docNames = (await readdir(docsDir)).filter((name) => name.endsWith('.md')).sort();
  const files = [path.join(root, briefName), ...docNames.map((name) => path.join(docsDir, name))];
  const findings: DocFinding[] = [];
  for (const file of files) {
    findings.push(...(await checkDocFile(root, file, pending)));
  }
  findings.push(...checkBriefLength(await readFile(path.join(root, briefName), 'utf8')));
  findings.push(...(await checkPending(root, pending)));
  return findings;
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '..');
  const findings = await checkDocs(root, notYetBuilt);
  for (const finding of findings) {
    console.error(`${finding.file}:${String(finding.line)}: ${finding.message}`);
  }
  if (findings.length > 0) process.exit(1);
  const pendingNote =
    notYetBuilt.length > 0
      ? `; ${String(notYetBuilt.length)} documented paths not built yet: ${notYetBuilt.join(', ')}`
      : '';
  console.log(`check-docs: docs name only paths that exist${pendingNote}`);
}
