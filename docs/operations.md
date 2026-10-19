# Operations

## Domains

Both domains are registered at GoDaddy and are active zones on Cloudflare's free plan, with Cloudflare's name servers (checked 2026-10-19).

Target:

| Domain | Does |
|---|---|
| thedoormanfallacy.com | Serves the site |
| www.thedoormanfallacy.com | 301 to the apex, path kept |
| doormanfallacy.com and www | 301 to https://thedoormanfallacy.com, path kept |

All four hostnames are custom domains of the Worker, which redirects every host but thedoormanfallacy.com ([D-015](decisions.md)). Custom domains create their DNS records at deploy, so no record or rule is set by hand.

## Release

One command, `npm run release`. It stops at the first failing step.

1. Fast checks: lint, types, unit tests, Worker tests, copy, docs and case checks.
2. Build `dist/` once.
3. Site tests against that `dist/`.
4. List the pending D1 migrations (`wrangler d1 migrations list doorman-fallacy --remote`), then apply them.
5. `wrangler deploy --dry-run`, then `wrangler deploy` with the same `dist/`.

To undo: `wrangler rollback` returns the previous Worker and site. A migration is undone by a new migration. The release command prints both before it acts.

## Before the first deploy

Five things exist only in Cloudflare and cfmail, so nothing in the repository can make them. Do them in this order. Each one says how to undo it. Nothing here is done yet (2026-10-19). `npm run release` fails until steps 1 and 4 are done, and sign-ups cannot send their confirmation email until steps 2 and 3 are.

1. **The D1 database.** `npx wrangler d1 create doorman-fallacy --jurisdiction eu`. Wrangler prints the database's `database_id`; add it to the `d1_databases` entry in `wrangler.jsonc` as `"database_id"` and commit it (an identifier, not a secret). The EU jurisdiction keeps the subscribers' addresses inside the EU and cannot be changed afterwards. To undo: `npx wrangler d1 delete doorman-fallacy`, then remove the line. That deletes every row, which is harmless before launch.
2. **The mail domain in cfmail.** Add thedoormanfallacy.com to the shared deployment, following cfmail's AGENTS.md section 3: check its mail, route it to the app, `wrangler email sending enable thedoormanfallacy.com`, and add it under Admin, Domains with the kind "service" ticked. To undo: reverse those steps, ending with removing the domain under Admin, Domains.
3. **The service mailbox.** Following cfmail's AGENTS.md section 5.5: Admin, Service, the name `noreply`, the domain thedoormanfallacy.com, "send-only". The app shows the API key once. To undo: delete the service in Admin, Service, which stops its key at once.
4. **The secret.** With the key still on the clipboard: `pbpaste | npx wrangler secret put CFMAIL_KEY`. The key never appears on screen or in the shell history. The Worker does not exist yet, so Wrangler offers to create it; accept. `wrangler deploy` refuses to run without this secret, because `wrangler.jsonc` lists it as required. To undo: `npx wrangler secret delete CFMAIL_KEY`. To replace a key that leaked, use "Rotate key" in cfmail, then repeat this step.
5. **The four custom domains.** The first `npm run release` creates them from the `routes` in `wrangler.jsonc`, with their DNS records and certificates. They need no setup, but each hostname must have no DNS record in its zone, or the deploy refuses; delete a stray record first. To undo: remove the domain in the Worker's Domains and Routes settings in the Cloudflare dashboard, or remove its entry from `routes` and release again.

After the first release, check that the Worker answers: the home page loads, `https://www.doormanfallacy.com/idea` redirects to `https://thedoormanfallacy.com/idea`, and a sign-up with Jan's own address delivers the confirmation email.

## Running the Worker locally

`npm run build`, then `npx wrangler d1 migrations apply doorman-fallacy --local`, then `npm run dev:worker`, which serves the site and the form routes on http://localhost:8787. The script passes `--local-upstream localhost:8787` because Wrangler otherwise shows the Worker the first custom domain as the request's host, and the Worker would redirect every page to https. The local database lives under `.wrangler/` and holds test data only. The confirmation email needs a `CFMAIL_KEY`; put one in `.dev.vars` (git ignores it) or leave it out, and a sign-up then fails at the mail step and shows the "did not go through" page. Never run `wrangler dev --remote`: it would use the real database.

## Form data

The suggest and subscribe routes hold their rate limit in D1, as a hash of the visitor's address ([D-016](decisions.md)); the daily job deletes those rows within a day. The daily job also deletes unconfirmed subscribers after 7 days and blanks names and emails on suggestions 90 days after they are resolved ([data-model.md](data-model.md#d1)). It logs counts only. To see that it ran, read the Worker's logs in the Cloudflare dashboard for a `retention` line.

## The desk's weekly run

Runs on Jan's Mac every Monday morning through launchd, using Claude Code on Jan's subscription ([D-012](decisions.md)). If the Mac is asleep, it runs at the next wake. How the desk narrows the news, and what each stage costs: [desk.md](desk.md). Each run:

1. **Sweep.** Fetch the news searches and new suggestions from D1. Drop duplicates and anything in `seen`. No model calls.
2. **Triage.** Jev judges each lead's headline, and code ranks the organisations by doorman priority.
3. **Assess.** A Claude agent researches the strongest organisations and rates each one's doorman fit: draft, watch or reject.
4. **Draft.** For each case recommended for drafting, and each update, an agent writes the case. Every source is archived on the Wayback Machine, and every quote is selected from the page's own sentences.
5. **Check.** The publishing checks ([engineering.md](engineering.md#publishing-checks)). A failure goes back to the drafting agent once; a second failure rejects the draft.
6. **Publish.** Passing cases are committed to the public repository and released.
7. **Review.** Cases due for review run their watch searches. News becomes a drafted update and goes through steps 5 and 6. If there is no news, only `lastChecked` changes.
8. **Report.** One email to Jan through cfmail: published, updated, watched, rejected with reasons, and any failure in the run.

The run records itself in D1's `runs` table. A run that stops part-way says where in the report, and the next run starts from the leads that are still open.

Jan does not need to act on the report. To take a case down: `npm run unpublish -- <slug>`, which removes it in one commit with the reason, and releases.

## Site health

A scheduled GitHub Action, free once the repository is public, fetches the home page and both redirects each day. If either fails, GitHub emails Jan. It runs separately from the desk, so a sleeping Mac cannot hide a broken site.

## Email

cfmail sends the site's mail through a service mailbox, `noreply@thedoormanfallacy.com` ([D-008](decisions.md)). Setup follows cfmail's AGENTS.md, section 3 (add the domain) and section 5.5 (service mailbox). The key goes straight into the Worker's secrets as `CFMAIL_KEY` and is never shown.

| Mail | When |
|---|---|
| Confirm your subscription | On sign-up |
| The desk's weekly report | After each run, to Jan |

The monthly letter is not sent through cfmail. Cloudflare Email Sending allows only transactional mail, and a review of the account would pause sending for every project on cfmail. The letter's sender is chosen when there are subscribers and something to send.

## Analytics

Cloudflare Web Analytics. It sets no cookies, so the site needs no cookie banner. The privacy page says so.
