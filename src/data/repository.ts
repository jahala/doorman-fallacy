/** Where the site's code and every case's history are public. One home for the address. */
const url = 'https://github.com/jahala/doorman-fallacy';

export const repository = {
  url,
  licence: `${url}/blob/master/LICENSE`,
  /** Every change ever made to one case, as Git history. */
  caseHistory: (slug: string): string => `${url}/commits/master/src/content/cases/${slug}.md`,
} as const;
