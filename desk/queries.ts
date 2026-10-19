/**
 * The news searches the sweep runs. The small set is for quick tests; the full set is the
 * weekly run. Nordic searches run in each language's own Google News edition, because local
 * coverage often comes first and reaches English sources late or never (DNB, 2026-10).
 */
export type Edition = 'en' | 'no' | 'sv' | 'da';

export interface Search {
  readonly query: string;
  readonly edition: Edition;
}

const english = (query: string): Search => ({ query, edition: 'en' });

export const smallQueries: readonly Search[] = [
  english('"replaced by AI" jobs'),
  english('"job cuts" AI automation'),
  english('rehire workers after AI'),
];

export const nordicQueries: readonly Search[] = [
  { query: '"kunstig intelligens" nedbemanning', edition: 'no' },
  { query: 'KI kutter stillinger', edition: 'no' },
  { query: '"erstattet av KI"', edition: 'no' },
  { query: '"artificiell intelligens" uppsägningar', edition: 'sv' },
  { query: 'AI varsel uppsägningar', edition: 'sv' },
  { query: '"ersätts av AI"', edition: 'sv' },
  { query: '"kunstig intelligens" fyringer', edition: 'da' },
  { query: 'AI fyrer medarbejdere', edition: 'da' },
  { query: '"erstattet af AI"', edition: 'da' },
];

export const fullQueries: readonly Search[] = [
  ...smallQueries,
  english('layoffs "because of AI"'),
  english('layoffs "artificial intelligence"'),
  english('replace workers "with AI"'),
  english('AI "customer service" jobs cut'),
  english('reverses AI job cuts'),
  english('AI redundancies staff'),
  english('chatbot replaces staff'),
  english('"hiring freeze" AI roles'),
  english('union AI job losses'),
  english('company cuts roles AI'),
  ...nordicQueries,
];
