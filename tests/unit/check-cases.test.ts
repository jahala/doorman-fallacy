import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCases, checkCaseText, maxBodyStatements, resolveFootnoteLabel, type CaseRule } from '../../scripts/check-cases.ts';
import { readCaseFixtureText } from './fixture-case.ts';

const root = path.resolve(import.meta.dirname, '../..');
const script = path.join(root, 'scripts/check-cases.ts');

function check(fixture: string): ReturnType<typeof checkCaseText> {
  return checkCaseText(`${fixture}.md`, readCaseFixtureText(fixture));
}

/** The distinct rules a fixture breaks, sorted. */
function rulesBroken(fixture: string): CaseRule[] {
  return [...new Set(check(fixture).map((finding) => finding.rule))].sort();
}

/** The valid fixture with one piece of its text swapped, for the edge cases a whole fixture would be too much for. */
function valid(change: (text: string) => string): ReturnType<typeof checkCaseText> {
  return checkCaseText('edited.md', change(readCaseFixtureText('valid')));
}

describe('archived copies', () => {
  it('flags a source whose archived copy is of another site, such as an analytics frame', () => {
    const findings = valid((text) =>
      text.replace(/archive: https:\/\/web\.archive\.org\/web\/(\d+)\/https?:\/\/[^\s]+/, 'archive: https://web.archive.org/web/$1/https://opus.analytics.yahoo.com/tag/opus-frame.html'),
    );
    expect(findings.map((finding) => finding.rule)).toContain('archive-other-site');
  });
});

describe('the length of the body', () => {
  /** The valid fixture with extra cited sentences in "What happened next", until the body holds `total`. */
  function withStatements(total: number): ReturnType<typeof checkCaseText> {
    const text = readCaseFixtureText('valid');
    const opening = text.indexOf('## The role');
    const open = text.indexOf('## Open questions');
    const present = [...text.slice(opening, open).matchAll(/\[\^[^\]\s]+\]/g)].length;
    const extra = Array.from({ length: Math.max(0, total - present) }, () => 'The bank said the work continued.[^gazette-background]').join(' ');
    return checkCaseText('edited.md', extra === '' ? text : text.replace('## Open questions', `${extra}\n\n## Open questions`));
  }

  it('passes a body at the limit', () => {
    expect(withStatements(maxBodyStatements)).toEqual([]);
  });

  it('flags a body over the limit, so a long case cannot hide what happened', () => {
    expect(withStatements(maxBodyStatements + 1)).toEqual([expect.objectContaining({ rule: 'body-length', line: 0 })]);
  });
});

describe('a valid case', () => {
  it('passes with no findings', () => {
    expect(check('valid')).toEqual([]);
  });

  it('counts a source cited only in the body as cited, and flags it once that citation is gone', () => {
    // gazette-background is listed under sources and appears nowhere else in the front matter.
    const withoutBodyCitation = checkCaseText(
      'edited.md',
      readCaseFixtureText('valid')
        .replace('[^gazette-background]', '')
        .replace(/\[\^gazette-background\]:.*\n/, ''),
    );
    expect(withoutBodyCitation).toEqual([
      expect.objectContaining({ rule: 'source-uncited', message: 'Source gazette-background is cited nowhere' }),
    ]);
  });
});

describe('a case that breaks a rule fails for that rule and no other', () => {
  const rows: readonly [string, CaseRule, string][] = [
    ['invalid-heading-missing', 'heading-missing', 'Missing heading "## The change"'],
    ['invalid-heading-order', 'heading-order', 'Headings must appear in this order'],
    ['invalid-heading-extra', 'heading-extra', 'Heading "## Background" is not one of the four allowed headings'],
    ['invalid-footnote-unknown-source', 'footnote-unknown-source', 'Footnote [^dnb-release-2] matches no source id'],
    ['invalid-footnote-undefined', 'footnote-undefined', 'Footnote [^gazette-waits-2] is used but never defined'],
    ['invalid-footnote-duplicate', 'footnote-duplicate', 'Footnote [^gazette-waits-2] is defined more than once'],
    ['invalid-source-uncited', 'source-uncited', 'Source unused-source is cited nowhere'],
    ['invalid-paragraph-no-footnote', 'paragraph-no-footnote', 'has no footnote'],
    ['invalid-footnote-no-quote', 'footnote-no-quote', 'Footnote [^union-statement] holds no quoted string of at least 4 words'],
    ['invalid-missing-archive', 'schema', 'sources.0.archive'],
    ['invalid-summary-too-long', 'schema', 'updates.0.summary'],
    ['invalid-change-too-long', 'schema', 'change'],
    ['invalid-unknown-status', 'schema', 'updates.1.status'],
    ['invalid-updates-out-of-order', 'schema', 'Updates run oldest first'],
    ['invalid-unknown-hidden-function', 'schema', 'missed.1.function'],
    ['invalid-no-update-sources', 'schema', 'updates.1.sources'],
    ['invalid-missed-no-sources', 'schema', 'missed.0.sources'],
    ['invalid-source-id-not-a-slug', 'schema', 'sources.3.id'],
    ['invalid-duplicate-source-id', 'schema', 'Source id gazette-background is used twice'],
    ['invalid-claim-source-unknown', 'schema', 'Cites no-such-source, which is not in sources'],
    ['invalid-missed-source-unknown', 'schema', 'Cites no-such-source, which is not in sources'],
    ['invalid-update-source-unknown', 'schema', 'Cites no-such-source, which is not in sources'],
    ['invalid-claim-quote-short', 'schema', 'claims.0.quote'],
    ['invalid-update-quote-short', 'schema', 'updates.1.quote'],
  ];

  it.each(rows)('%s: %s', (fixture, rule, reason) => {
    expect(rulesBroken(fixture)).toEqual([rule]);
    expect(check(fixture).some((finding) => finding.message.includes(reason))).toBe(true);
  });

  it('also reports a case with no sources at all as one that cites sources it does not have', () => {
    // With nothing listed under sources, every footnote has nothing to match.
    expect(rulesBroken('invalid-no-sources-listed')).toEqual(['footnote-unknown-source', 'schema']);
    expect(check('invalid-no-sources-listed').some((finding) => finding.message.includes('sources'))).toBe(true);
  });
});

describe('findings name the file and the line', () => {
  it('points at the paragraph that has no footnote', () => {
    const text = readCaseFixtureText('invalid-paragraph-no-footnote');
    const line = text.split('\n').findIndex((row) => row.startsWith('Reporters described longer waits')) + 1;
    expect(check('invalid-paragraph-no-footnote')).toEqual([
      expect.objectContaining({ file: 'invalid-paragraph-no-footnote.md', line, rule: 'paragraph-no-footnote' }),
    ]);
  });

  it('points at the extra heading', () => {
    const text = readCaseFixtureText('invalid-heading-extra');
    const line = text.split('\n').indexOf('## Background') + 1;
    expect(check('invalid-heading-extra')[0]).toMatchObject({ line, rule: 'heading-extra' });
  });

  it('points at the footnote reference that matches no source', () => {
    const text = readCaseFixtureText('invalid-footnote-unknown-source');
    const line = text.split('\n').findIndex((row) => row.includes('The bank announced') && row.includes('dnb-release-2')) + 1;
    expect(check('invalid-footnote-unknown-source')[0]).toMatchObject({ line, rule: 'footnote-unknown-source' });
  });
});

describe('resolveFootnoteLabel', () => {
  const ids = new Set(['gazette-waits', 'acs-2025-08', 'acs-2025']);

  it('takes a label that is a source id as it is', () => {
    expect(resolveFootnoteLabel('gazette-waits', ids)).toBe('gazette-waits');
    expect(resolveFootnoteLabel('acs-2025-08', ids)).toBe('acs-2025-08');
  });

  it('strips a trailing -n, a positive integer, when the label itself is no source id', () => {
    expect(resolveFootnoteLabel('gazette-waits-2', ids)).toBe('gazette-waits');
    expect(resolveFootnoteLabel('gazette-waits-12', ids)).toBe('gazette-waits');
    expect(resolveFootnoteLabel('acs-2025-08-2', ids)).toBe('acs-2025-08');
  });

  it('checks the exact id first, so an id ending in a number is not cut short', () => {
    expect(resolveFootnoteLabel('acs-2025-08', ids)).not.toBe('acs-2025');
  });

  it('resolves nothing when neither form matches', () => {
    expect(resolveFootnoteLabel('dnb-release', ids)).toBeUndefined();
    expect(resolveFootnoteLabel('dnb-release-2', ids)).toBeUndefined();
  });

  it('strips only one suffix, and only a positive integer without leading zeros', () => {
    expect(resolveFootnoteLabel('gazette-waits-2-3', ids)).toBeUndefined();
    expect(resolveFootnoteLabel('gazette-waits-0', ids)).toBeUndefined();
    expect(resolveFootnoteLabel('gazette-waits-02', ids)).toBeUndefined();
    expect(resolveFootnoteLabel('acs-2025-9', ids)).toBe('acs-2025');
    expect(resolveFootnoteLabel('gazette-waits-x', ids)).toBeUndefined();
  });

  it('lets a label with a suffix cite its source, so the source counts as cited', () => {
    const text = readCaseFixtureText('valid').replace('[^gazette-background]', '[^gazette-background-3]').replace('[^gazette-background]:', '[^gazette-background-3]:');
    expect(checkCaseText('edited.md', text)).toEqual([]);
  });
});

describe('edge cases of the body rules', () => {
  it('asks for a footnote on every item of a list under What happened next', () => {
    const findings = valid((text) => text.replace('The union said team leaders were answering calls.[^union-statement]', 'The union said team leaders were answering calls.'));
    expect(findings.map((finding) => finding.rule)).toEqual(['paragraph-no-footnote']);
  });

  it('accepts a paragraph whose footnote sits in the middle of it', () => {
    const findings = valid((text) =>
      text.replace(
        'Reporters described longer waits after the voice bot launched.[^gazette-waits]',
        'Reporters described longer waits.[^gazette-waits] They also described overtime.',
      ),
    );
    expect(findings).toEqual([]);
  });

  it('does not ask for footnotes under the other headings', () => {
    expect(valid((text) => text.replace('The bank announced that 45 roles would be cut.[^bank-notice]', 'The bank announced the cut.'))).toEqual([]);
  });

  it('counts a footnote definition as a definition wherever it stands, and never as a paragraph', () => {
    const findings = valid((text) => {
      const definition = '[^gazette-waits]: "customers waited longer and team leaders took calls"\n';
      return text.replace(definition, '').replace('## Open questions', `${definition}\n## Open questions`);
    });
    expect(findings).toEqual([]);
  });

  it('reads a quote in curly quotation marks, and one on a continuation line', () => {
    const findings = valid((text) =>
      text.replace(
        '[^union-statement]: "team leaders have been pulled onto the phones"',
        '[^union-statement]:\n    “team leaders have been pulled onto the phones”',
      ),
    );
    expect(findings).toEqual([]);
  });

  it('accepts a definition with one short quote and one long quote', () => {
    const findings = valid((text) =>
      text.replace(
        '"team leaders have been pulled onto the phones"',
        '"pulled" and "team leaders have been pulled onto the phones"',
      ),
    );
    expect(findings).toEqual([]);
  });

  it('ignores headings and footnote marks inside a fenced code block', () => {
    const findings = valid((text) => text.replace('## Open questions', '```\n## Not a heading\n[^nothing]\n```\n\n## Open questions'));
    expect(findings).toEqual([]);
  });

  it('reports a case with no front matter, and one whose front matter is not YAML', () => {
    expect(checkCaseText('a.md', '## The role\n').map((finding) => finding.rule)).toEqual(['front-matter']);
    expect(checkCaseText('b.md', '---\nkey: [unclosed\n---\n\n## The role\n').map((finding) => finding.rule)).toEqual(['front-matter']);
  });

  it('reports every heading problem, not only the first', () => {
    const findings = valid((text) => text.replace('## The change', '## Background').replace('## Open questions', '## Notes'));
    expect(findings.map((finding) => [finding.rule, finding.message])).toEqual([
      ['heading-extra', 'Heading "## Background" is not one of the four allowed headings'],
      ['heading-extra', 'Heading "## Notes" is not one of the four allowed headings'],
      ['heading-missing', 'Missing heading "## The change"'],
      ['heading-missing', 'Missing heading "## Open questions"'],
    ]);
  });

  it('flags a heading that is repeated', () => {
    const findings = valid((text) => `${text}\n## Open questions\n\nMore.\n`);
    expect(findings.map((finding) => finding.rule)).toEqual(['heading-order']);
  });
});

describe('checkCases, over a folder of case files', () => {
  async function inTempFolder(files: Record<string, string>, run: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'check-cases-'));
    try {
      for (const [name, text] of Object.entries(files)) await writeFile(path.join(folder, name), text);
      await run(folder);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  it('passes when there are no cases', async () => {
    await inTempFolder({}, async (folder) => {
      expect(await checkCases(folder)).toEqual([]);
    });
  });

  it('passes the real cases folder, which is empty until the first case is published', async () => {
    expect(await checkCases(path.join(root, 'src/content/cases'))).toEqual([]);
  });

  it('checks every .md file and names the one that fails', async () => {
    await inTempFolder(
      {
        'good-2025.md': readCaseFixtureText('valid'),
        'bad-2025.md': readCaseFixtureText('invalid-heading-missing'),
        'notes.txt': 'not a case',
      },
      async (folder) => {
        const findings = await checkCases(folder);
        expect(findings.map((finding) => [finding.file, finding.rule])).toEqual([['bad-2025.md', 'heading-missing']]);
      },
    );
  });

  it('reports a folder that is not there instead of passing', async () => {
    const findings = await checkCases(path.join(os.tmpdir(), 'check-cases-no-such-folder'));
    expect(findings).toEqual([expect.objectContaining({ line: 0, rule: 'folder' })]);
  });
});

describe('the command', () => {
  it('exits with success on the real cases folder', () => {
    const run = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('check-cases');
    expect(run.stderr).toBe('');
  });

  it('exits with failure on a folder holding a broken case, naming file, line and rule', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'check-cases-'));
    try {
      await writeFile(path.join(folder, 'bad-2025.md'), readCaseFixtureText('invalid-paragraph-no-footnote'));
      const run = spawnSync(process.execPath, [script, folder], { cwd: root, encoding: 'utf8' });
      expect(run.status).toBe(1);
      expect(run.stderr).toMatch(/bad-2025\.md:\d+: \[paragraph-no-footnote\]/);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
});
