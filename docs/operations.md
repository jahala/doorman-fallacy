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

`desk/weekly.ts` runs every Monday at 07:00 on Jan's Mac, using Claude Code on Jan's subscription ([D-012](decisions.md)). How the desk narrows the news, and what each stage costs: [desk.md](desk.md). Each run:

1. **Sweep** the last eight days of news.
2. **Set aside** organisations already in the ledger, and those assessed in the last 30 days (`.desk-runs/assessed.json`, entries kept 180 days).
3. **Assess** the strongest new leads.
4. **Draft and publish** each case the assessor recommends, through the [publishing checks](engineering.md#publishing-checks).
5. **List** news about cases already in the ledger, and cases due for review. Drafting updates from that news is not built yet.
6. **Commit and push** the new cases (the pre-push hook runs the checks), write the report to the run's folder, and post a Mac notification. A run with any failure says so in the notification and exits non-zero.

Each stage runs as its own process with a fixed share of the week's budget (default $3), so the total cannot pass it. The report will also go to Jan by email once thedoormanfallacy.com is set up in cfmail.

Install the schedule with `scripts/install-desk-schedule.sh`. It runs the desk from its own worktree on master (`df-desk` beside the repository), so the weekly commit never lands in a checkout someone is editing, and it prints how to undo itself before it acts. If the Mac is asleep at 07:00, launchd runs the job when it wakes, and the report marks the run as late when more than seven days have passed. Each run overwrites `.desk-runs/last-run.log` in that worktree.

To take a case down: delete its file in one commit that says why, and release.
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
