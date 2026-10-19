import { redirectTarget } from '../lib/hosts.ts';
import type { Deps } from './deps.ts';
import { methodNotAllowed, see } from './http.ts';
import { suggest } from './suggest.ts';
import { confirm, subscribe, unsubscribe, unsubscribePage } from './subscribe.ts';

/**
 * Answers one request: the host redirect first (D-015), then the form routes, then the built site.
 * Everything that is not a form route belongs to the static assets.
 */
export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const target = redirectTarget(request.url);
  if (target !== null) return new Response(null, { status: 301, headers: { location: target } });

  const { pathname } = new URL(request.url);
  const method = request.method;
  switch (pathname) {
    case '/api/suggest':
      return method === 'POST' ? suggest(request, env, deps) : methodNotAllowed('POST');
    case '/api/subscribe':
      return method === 'POST' ? subscribe(request, env, deps) : methodNotAllowed('POST');
    case '/confirm':
      return method === 'GET' ? confirm(request, env, deps) : methodNotAllowed('GET');
    case '/unsubscribe':
      if (method === 'GET') return unsubscribePage(request, env);
      return method === 'POST' ? unsubscribe(request, env) : methodNotAllowed('GET, POST');
    case '/subscribe/unsubscribe':
    case '/subscribe/unsubscribe/':
      // This page exists to be served at /unsubscribe, with a token. On its own it has none.
      return see('/subscribe/problem');
    default:
      return env.ASSETS.fetch(request);
  }
}
