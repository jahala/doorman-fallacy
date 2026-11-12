import { parseEmail } from '../lib/email-address.ts';
import { firstValue, isHoneypotFilled } from '../lib/form.ts';
import { cutoffs } from '../lib/limits.ts';
import { confirmationMessage, newSubscriberMessage } from '../lib/mail.ts';
import { isOneClickBody, isToken, tokenBytes, tokenFromBytes } from '../lib/subscriber.ts';
import type { Deps } from './deps.ts';
import { clientAddress, readForm, see } from './http.ts';
import { takeRatePlace } from './rate.ts';

const checkEmail = '/subscribe/check-email';
const failed = '/subscribe/failed';
const problem = '/subscribe/problem';

interface Sent {
  readonly token: string;
  readonly token_sent_at: string;
}

/**
 * POST /api/subscribe: stores an unconfirmed address and emails a confirmation link. Every outcome
 * a person cannot cause themselves looks the same from outside: an address that is already
 * subscribed, or was sent a link a moment ago, gets the same page and no email.
 */
export async function subscribe(request: Request, env: Env, deps: Deps): Promise<Response> {
  const form = await readForm(request);
  if (form === null) return see(failed);
  if (isHoneypotFilled(form)) return see(checkEmail);
  if (!(await takeRatePlace(env.DB, 'subscribe', clientAddress(request), deps.now))) return see(failed);
  const email = parseEmail(firstValue(form, 'email'));
  if (email === null) return see(failed);

  const now = deps.now.toISOString();
  const token = tokenFromBytes(deps.randomBytes(tokenBytes));
  const before = await env.DB.prepare('SELECT token, token_sent_at FROM subscribers WHERE email = ?1').bind(email).first<Sent>();

  // One statement decides whether this request may send: a new address, or an unconfirmed one whose
  // last email is old enough. Two requests arriving together cannot both win.
  const claim = await env.DB.prepare(
    `INSERT INTO subscribers (email, token, created_at, token_sent_at)
     VALUES (?1, ?2, ?3, ?3)
     ON CONFLICT (email) DO UPDATE SET token = excluded.token, token_sent_at = excluded.token_sent_at
     WHERE subscribers.confirmed_at IS NULL AND subscribers.token_sent_at <= ?4`,
  )
    .bind(email, token, now, cutoffs(deps.now).resendBefore)
    .run();
  if (claim.meta.changes !== 1) return see(checkEmail);

  const sent = await deps.sendMail(confirmationMessage(email, token));
  if (sent.ok) return see(checkEmail);

  // Nothing went out, so put the row back as it was and let the person try again at once.
  if (before === null) {
    await env.DB.prepare('DELETE FROM subscribers WHERE email = ?1 AND token = ?2').bind(email, token).run();
  } else {
    await env.DB.prepare('UPDATE subscribers SET token = ?3, token_sent_at = ?4 WHERE email = ?1 AND token = ?2')
      .bind(email, token, before.token, before.token_sent_at)
      .run();
  }
  return see(failed);
}

/**
 * GET /confirm?token=: confirms an address whose link has not expired. Confirming twice is fine. The
 * first confirmation, and only that one, sends the site a note with the total; the statement that
 * confirms decides which request is first, so two at once cannot both send it.
 */
export async function confirm(request: Request, env: Env, deps: Deps): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!isToken(token)) return see(problem);
  const first = await env.DB.prepare('UPDATE subscribers SET confirmed_at = ?1 WHERE token = ?2 AND confirmed_at IS NULL AND token_sent_at >= ?3')
    .bind(deps.now.toISOString(), token, cutoffs(deps.now).unconfirmedBefore)
    .run();
  if (first.meta.changes === 1) {
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE confirmed_at IS NOT NULL').first<{ n: number }>();
    // The confirmation stands whether or not the note goes out.
    await deps.sendMail(newSubscriberMessage(total?.n ?? 1));
    return see('/subscribe/confirmed');
  }
  const already = await env.DB.prepare('SELECT 1 AS yes FROM subscribers WHERE token = ?1 AND confirmed_at IS NOT NULL').bind(token).first();
  return see(already === null ? problem : '/subscribe/confirmed');
}

/**
 * GET /unsubscribe?token=: shows the one-button page and changes nothing, so a mail scanner that
 * opens the link cannot unsubscribe anyone. The page is the built /subscribe/unsubscribe/, served
 * here, at this address, so that its form posts back to this address with the token in the query.
 */
export async function unsubscribePage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!isToken(url.searchParams.get('token') ?? '')) return see(problem);
  const page = await env.ASSETS.fetch(new URL('/subscribe/unsubscribe/', url));
  const headers = new Headers(page.headers);
  // The address holds a secret: keep it out of caches and out of the Referer header.
  headers.set('cache-control', 'no-store');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-robots-tag', 'noindex');
  return new Response(page.body, { status: page.status, headers });
}

/**
 * POST /unsubscribe: deletes the row. The token comes from the query (the page's form posts to its
 * own address) or from a form field. A mail program's one-click request (RFC 8058) gets a plain 200.
 * An address that is already gone is unsubscribed all the same.
 */
export async function unsubscribe(request: Request, env: Env): Promise<Response> {
  const form = (await readForm(request)) ?? {};
  const oneClick = isOneClickBody(form);
  const token = new URL(request.url).searchParams.get('token') ?? firstValue(form, 'token');
  if (!isToken(token)) {
    return oneClick ? new Response('Bad request', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } }) : see(problem);
  }
  await env.DB.prepare('DELETE FROM subscribers WHERE token = ?1').bind(token).run();
  return oneClick
    ? new Response('Unsubscribed', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    : see('/subscribe/unsubscribed');
}
