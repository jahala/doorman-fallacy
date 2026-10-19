/** Groups triaged leads by organisation and ranks the groups by doorman priority. */
import type { Lead } from '../src/lib/leads.ts';
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

export function clusters(triaged: readonly Triaged[]): Cluster[] {
  const groups = new Map<string, Triaged[]>();
  for (const item of triaged) {
    if (item.triage === null) continue;
    const key = item.triage.company?.toLowerCase() ?? `unnamed:${item.url}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => priority(b) - priority(a));
      const top = sorted[0];
      return { key, name: top?.triage?.company ?? '(no organisation named)', best: top === undefined ? 0 : priority(top), items: sorted };
    })
    .sort((a, b) => b.best - a.best || b.items.length - a.items.length);
}
