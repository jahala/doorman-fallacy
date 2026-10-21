/** Groups triaged leads by organisation and ranks the groups by doorman priority. */
import { sameOrganisation, type Lead } from '../src/lib/leads.ts';
import { doormanPriority, type Triage } from './triage.ts';

export interface Triaged extends Lead {
  readonly triage: Triage | null;
  readonly error?: string;
}

export interface Cluster {
  readonly key: string;
  readonly name: string;
  readonly best: number;
  readonly items: Triaged[];
}

const priority = (item: Triaged): number => (item.triage === null ? 0 : doormanPriority(item.triage));

/** Groups leads by organisation, joining name variants ("DNB" and "DNB Bank") under the longest name. */
export function clusters(triaged: readonly Triaged[]): Cluster[] {
  const groups = new Map<string, Triaged[]>();
  for (const item of triaged) {
    if (item.triage === null) continue;
    const company = item.triage.company;
    if (company === null) {
      groups.set(`unnamed:${item.url}`, [item]);
      continue;
    }
    const existing = [...groups.keys()].find((key) => !key.startsWith('unnamed:') && sameOrganisation(key, company));
    const key = existing === undefined || company.length > existing.length ? company.toLowerCase() : existing;
    const members = existing === undefined ? [] : (groups.get(existing) ?? []);
    if (existing !== undefined) groups.delete(existing);
    groups.set(key, [...members, item]);
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => priority(b) - priority(a));
      const top = sorted[0];
      const longest = sorted.map((item) => item.triage?.company ?? '').reduce((a, b) => (b.length > a.length ? b : a), '');
      return { key, name: longest === '' ? '(no organisation named)' : longest, best: top === undefined ? 0 : priority(top), items: sorted };
    })
    .sort((a, b) => b.best - a.best || b.items.length - a.items.length);
}

/**
 * Groups worth sending to the assessor: every named organisation, and headlines that name none
 * but report a reversal or its aftermath, since those are the follow-ups the ledger exists for.
 */
export function assessable(group: Cluster): boolean {
  if (!group.key.startsWith('unnamed:')) return true;
  const kind = group.items[0]?.triage?.kind;
  return (kind === 'reversal' || kind === 'aftermath') && (group.items[0]?.triage?.isCase ?? 0) >= 0.3;
}

/**
 * Reports the assessor can open come first. A Google News link is a redirect that returns a page of
 * script with no publisher address, so a lead whose first reports are such links is assessed
 * without being read (British Gas, Standard Chartered, 2026-10-21).
 */
export function readableFirst<Item extends { readonly url: string }>(items: readonly Item[]): Item[] {
  const redirect = (entry: Item): boolean => entry.url.startsWith('https://news.google.com/');
  return [...items.filter((entry) => !redirect(entry)), ...items.filter(redirect)];
}
