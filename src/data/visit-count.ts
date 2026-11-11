/**
 * The page-view counter (D-024): our own cookieless analytics on Cloudflare, in the EU. The token
 * is an ingest key, safe in page source. The counter sends only from the site's own host, so local
 * runs and tests count nothing.
 */
export const visitCount = {
  token: 'cfa_pk_bpYcaVgq7eZFx6soJYK5KCBdd8YmO8U-Ih6M_hcq524',
  intakeHost: 'e.thedoormanfallacy.com',
  siteHost: 'thedoormanfallacy.com',
} as const;
