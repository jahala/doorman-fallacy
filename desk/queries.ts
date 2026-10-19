/**
 * The news searches the sweep runs. English first; other languages come later.
 * The small set is for quick tests; the full set is the weekly run.
 */
export const smallQueries: readonly string[] = [
  '"replaced by AI" jobs',
  '"job cuts" AI automation',
  'rehire workers after AI',
];

export const fullQueries: readonly string[] = [
  ...smallQueries,
  'layoffs "because of AI"',
  'layoffs "artificial intelligence"',
  'replace workers "with AI"',
  'AI "customer service" jobs cut',
  'reverses AI job cuts',
  'AI redundancies staff',
  'chatbot replaces staff',
  '"hiring freeze" AI roles',
  'union AI job losses',
  'company cuts roles AI',
];
