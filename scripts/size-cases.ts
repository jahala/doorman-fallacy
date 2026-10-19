import { stringify } from 'yaml';
import { statusIds } from '../src/data/statuses.ts';

/**
 * Synthetic cases for the size test (docs/engineering.md). Every name and link is made up, and
 * every case passes the schema and the case checks. Ledger text sits near its length limits,
 * so a page of these weighs about as much as a page of long real entries.
 */

export interface SyntheticCase {
  readonly fileName: string;
  readonly text: string;
}

const summaries: Readonly<Record<(typeof statusIds)[number], string>> = {
  'too-early': 'The cut was announced and nothing has been reported on how it is going.',
  holding: 'Reports say the change works as intended and no roles were restored.',
  strained: 'Reports of longer waits, complaints and staff working overtime since the cut.',
  'partly-reversed': 'Some of the roles were restored after reports of problems with the change.',
  reversed: 'The organisation undid the cut and rehired people to the same roles.',
};

/** A date n days after 2024-01-01, written YYYY-MM-DD. */
function dayNumber(n: number): string {
  const date = new Date(Date.UTC(2024, 0, 1 + n));
  return date.toISOString().slice(0, 10);
}

/** Case number n, counting from 1. */
export function syntheticCase(n: number): SyntheticCase {
  const name = `Example Organisation ${String(n)}`;
  const slug = `example-organisation-${String(n)}`;
  const status = statusIds[n % statusIds.length] ?? 'too-early';
  const announced = dayNumber(n);
  const later = dayNumber(n + 30);
  const checked = dayNumber(n + 60);
  const roles = 10 + (n % 900);
  const source = (id: string, kind: 'primary' | 'reporting', published: string, title: string): Record<string, string> => ({
    id,
    kind,
    url: `https://example.com/${slug}/${id}`,
    publisher: kind === 'primary' ? name : 'Example Gazette',
    title,
    published,
    archive: `https://web.archive.org/web/${published.replaceAll('-', '')}000000/https://example.com/${slug}/${id}`,
  });

  const front = {
    company: name,
    short: name,
    country: 'NO',
    area: 'Customer service',
    change: `${String(roles)} roles cut for an AI assistant in its support team.`,
    announced,
    headcount: roles,
    door: 'Answering inbound calls and written customer questions',
    claims: [
      {
        date: announced,
        who: name,
        said: 'The assistant would reduce call volumes.',
        source: 'notice',
        quote: 'the assistant will reduce call volumes for the support team',
      },
    ],
    missed: [
      {
        function: 'judgment',
        evidence: 'Customers with unusual requests had nobody to escalate to.',
        sources: ['report'],
      },
      {
        function: 'slack',
        evidence: 'Team leaders were answering calls during the busiest weeks.',
        sources: ['notice', 'report'],
      },
    ],
    updates: [
      {
        date: announced,
        status: 'too-early',
        summary: summaries['too-early'],
        sources: ['notice'],
        quote: 'the assistant will reduce call volumes for the support team',
      },
      {
        date: later,
        status,
        summary: summaries[status],
        sources: ['report'],
        quote: 'customers waited longer and team leaders took calls',
      },
    ],
    corrections: [],
    suggestedBy: null,
    lastChecked: checked,
    watch: { queries: [`${name} AI assistant`, `${name} customer service jobs`], signals: ['rehiring', 'complaints'] },
    sources: [
      source('notice', 'primary', announced, 'Notice to staff about the assistant'),
      source('report', 'reporting', later, 'Waits grow after the assistant launched'),
    ],
    related: [],
  };

  const body = [
    'This is generated test data for the size test. It is not a real case.',
    '',
    '## The role',
    '',
    'The support team answered inbound calls from customers.[^notice]',
    '',
    '## The change',
    '',
    'The organisation announced that the roles would be cut.[^notice-2]',
    '',
    '## What happened next',
    '',
    'Reporters described longer waits after the assistant launched.[^report]',
    '',
    '- Team leaders were answering calls.[^report-2]',
    '',
    '## Open questions',
    '',
    'It is not yet reported whether call volumes returned to their earlier level.',
    '',
    '[^notice]: "the support team answered inbound calls from customers"',
    '[^notice-2]: "the assistant will reduce call volumes for the support team"',
    '[^report]: "customers waited longer and team leaders took calls"',
    '[^report-2]: "team leaders have been pulled onto the phones"',
    '',
  ].join('\n');

  return { fileName: `${slug}.md`, text: `---\n${stringify(front, { lineWidth: 0 })}---\n\n${body}` };
}
