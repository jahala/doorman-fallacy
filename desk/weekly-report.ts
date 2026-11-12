/** The desk's weekly report to Jan, as plain text. Pure: the run's results go in, the text comes out. */

export interface ReviewLine {
  readonly slug: string;
  readonly written: boolean;
  readonly added: number;
  readonly removed: number;
  readonly corrections: readonly string[];
  readonly problems: readonly string[];
}

export interface WeeklyResult {
  readonly today: string;
  readonly late: boolean;
  readonly leads: number;
  readonly published: readonly { slug: string; organisation: string }[];
  readonly notPublished: readonly { organisation: string; problems: readonly string[] }[];
  readonly watch: readonly { organisation: string; reason: string }[];
  readonly rejected: readonly { organisation: string; reason: string }[];
  /** Every case review that ran, whether or not it changed the case. */
  readonly reviews: readonly ReviewLine[];
  readonly suggestions: { readonly resolved: number; readonly open: number };
  /** Whether the week's changes reached the live site through `npm run release`. */
  readonly release: 'released' | 'failed' | 'nothing-to-release' | 'not-a-commit-run';
  readonly failures: readonly string[];
  readonly costUsd: { readonly sweep: number; readonly assess: number; readonly draft: number; readonly review: number };
  readonly budgetUsd: number;
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['', `${title}:`, ...lines];
}

function reviewLine(review: ReviewLine): string {
  if (!review.written) return `- ${review.slug}: not updated: ${review.problems.join('; ')}`;
  const parts = review.added + review.removed === 0 ? ['checked'] : [`${String(review.added)} statements added, ${String(review.removed)} removed`];
  if (review.corrections.length > 0) parts.push(`corrected: ${review.corrections.join(' ')}`);
  return `- ${review.slug}: ${parts.join('; ')}`;
}

function releaseLine(release: WeeklyResult['release']): string {
  if (release === 'released') return 'Released to thedoormanfallacy.com.';
  if (release === 'failed') return 'Not released: the release failed, so the site does not show this week\'s changes. See the run\'s log.';
  if (release === 'nothing-to-release') return 'Nothing new to release.';
  return 'Not released: a run without --commit changes nothing live.';
}

export function weeklyReport(result: WeeklyResult): string {
  const updated = result.reviews.filter((review) => review.written).length;
  const counts = [
    `${String(result.published.length)} published`,
    `${String(result.notPublished.length)} not published`,
    `${String(result.watch.length)} to watch`,
    `${String(result.rejected.length)} rejected`,
    `${String(updated)} case${updated === 1 ? '' : 's'} updated`,
  ].join(', ');
  const { sweep, assess, draft, review } = result.costUsd;
  const total = sweep + assess + draft + review;
  return [
    `Doorman desk, ${longDate(result.today)}${result.late ? ' (late run)' : ''}: ${counts}.`,
    '',
    `Leads read: ${String(result.leads)}.`,
    `Readers' suggestions: ${String(result.suggestions.resolved)} resolved, ${String(result.suggestions.open)} still open.`,
    releaseLine(result.release),
    ...section('Published', result.published.map((item) => `- ${item.organisation}: https://thedoormanfallacy.com/ledger/${item.slug}`)),
    ...section('Not published', result.notPublished.map((item) => `- ${item.organisation}: ${item.problems.join('; ')}`)),
    ...section('To watch', result.watch.map((item) => `- ${item.organisation}: ${item.reason}`)),
    ...section('Rejected', result.rejected.map((item) => `- ${item.organisation}: ${item.reason}`)),
    ...section('Cases reviewed', result.reviews.map(reviewLine)),
    '',
    `Cost: $${total.toFixed(2)} of a $${result.budgetUsd.toFixed(2)} budget (sweep $${sweep.toFixed(2)}, assessments $${assess.toFixed(2)}, drafts $${draft.toFixed(2)}, reviews $${review.toFixed(2)}).`,
    '',
    ...(result.failures.length === 0 ? ['No failures.'] : ['Failures:', ...result.failures.map((failure) => `- ${failure}`)]),
    '',
  ].join('\n');
}
