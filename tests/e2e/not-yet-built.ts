/**
 * Pages the site already links to that are not built yet. The link crawl skips exactly
 * these and nothing else. Remove an entry in the change that builds its page: a test
 * fails while a listed route already exists.
 */
export const notYetBuiltRoutes: readonly string[] = [
  '/idea', // The idea page
  '/ledger', // The ledger
  '/about', // About the curator
  '/sources', // Sources and approach
  '/privacy', // Privacy
];

/** In-page anchors the site links to whose target section is not built yet. */
export const notYetBuiltAnchors: readonly string[] = [
  '/#subscribe', // The sign-up section on the home page
];
