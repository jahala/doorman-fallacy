import { siteOrigin } from './site.ts';

const canonicalHost = new URL(siteOrigin).hostname;
const localHosts: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Where a request for this URL should be sent, or null to answer it where it is (D-015). Every host
 * but the canonical one goes to it, and so does plain http on a host that is not local. Path and
 * query are kept; the fragment never reaches a server. A URL that does not parse gives null.
 */
export function redirectTarget(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (localHosts.includes(url.hostname)) return null;
  if (url.hostname === canonicalHost && url.protocol === 'https:') return null;
  return `${siteOrigin}${url.pathname}${url.search}`;
}
