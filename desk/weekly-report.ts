/** The desk's weekly report to Jan, as plain text. Pure: the run's results go in, the text comes out. */

export interface WeeklyResult {
  readonly today: string;
  readonly late: boolean;
  readonly leads: number;
  readonly published: readonly { slug: string; organisation: string }[];
  readonly notPublished: readonly { organisation: string; problems: readonly string[] }[];
  readonly watch: readonly { organisation: string; reason: string }[];
  readonly rejected: readonly { organisation: string; reason: string }[];
  readonly newsForCases: readonly { slug: string; headlines: readonly string[] }[];
  readonly reviewsDue: readonly { slug: string; due: string }[];
  readonly failures: readonly string[];
  readonly costUsd: { readonly sweep: number; readonly assess: number; readonly draft: number };
  readonly budgetUsd: number;
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['', `${title}:`, ...lines];
}

export function weeklyReport(result: WeeklyResult): string {
  const counts = [
    `${String(result.published.length)} published`,
    `${String(result.notPublished.length)} not published`,
    `${String(result.watch.length)} to watch`,
    `${String(result.rejected.length)} rejected`,
    `${String(result.reviewsDue.length)} review${result.reviewsDue.length === 1 ? '' : 's'} due`,
  ].join(', ');
  const total = result.costUsd.sweep + result.costUsd.assess + result.costUsd.draft;
  return [
    `Doorman desk, ${longDate(result.today)}${result.late ? ' (late run)' : ''}: ${counts}.`,
    '',
    `Leads read: ${String(result.leads)}.`,
    ...section('Published', result.published.map((item) => `- ${item.organisation}: https://thedoormanfallacy.com/ledger/${item.slug}`)),
    ...section('Not published', result.notPublished.map((item) => `- ${item.organisation}: ${item.problems.join('; ')}`)),
    ...section('To watch', result.watch.map((item) => `- ${item.organisation}: ${item.reason}`)),
    ...section('Rejected', result.rejected.map((item) => `- ${item.organisation}: ${item.reason}`)),
    ...section('News about cases in the ledger', result.newsForCases.flatMap((item) => item.headlines.map((headline) => `- ${item.slug}: ${headline}`))),
    ...section('Reviews due', result.reviewsDue.map((item) => `- ${item.slug}, due ${item.due}`)),
    '',
    `Cost: $${total.toFixed(2)} of a $${result.budgetUsd.toFixed(2)} budget (sweep $${result.costUsd.sweep.toFixed(2)}, assessments $${result.costUsd.assess.toFixed(2)}, drafts $${result.costUsd.draft.toFixed(2)}).`,
    '',
    ...(result.failures.length === 0 ? ['No failures.'] : ['Failures:', ...result.failures.map((failure) => `- ${failure}`)]),
    '',
  ].join('\n');
}
