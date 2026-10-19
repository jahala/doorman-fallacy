import { isHoneypotFilled } from '../lib/form.ts';
import { parseSuggestion } from '../lib/suggestion.ts';
import type { Deps } from './deps.ts';
import { clientAddress, readForm, see } from './http.ts';
import { takeRatePlace } from './rate.ts';

/** POST /api/suggest: stores a suggested case or an error report. */
export async function suggest(request: Request, env: Env, deps: Deps): Promise<Response> {
  const form = await readForm(request);
  if (form === null) return see('/suggest/problem');
  // A bot gets the same thanks as a person and nothing is kept or counted.
  if (isHoneypotFilled(form)) return see('/suggest/thanks');
  if (!(await takeRatePlace(env.DB, 'suggest', clientAddress(request), deps.now))) return see('/suggest/problem');

  const parsed = parseSuggestion(form);
  if (!parsed.ok) return see('/suggest/problem');
  const { kind, caseSlug, links, note, name, email, credit } = parsed.value;

  await env.DB.prepare(
    `INSERT INTO suggestions (created_at, kind, case_slug, links, note, name, email, credit)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(deps.now.toISOString(), kind, caseSlug, JSON.stringify(links), note, name, email, credit ? 1 : 0)
    .run();
  return see('/suggest/thanks');
}
