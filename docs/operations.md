# Operations

## Domains

Both domains are registered at GoDaddy. Jan is moving their name servers to Cloudflare (2026-10-19).

Target:

| Domain | Does |
|---|---|
| thedoormanfallacy.com | Serves the site |
| www.thedoormanfallacy.com | 301 to the apex, path kept |
| doormanfallacy.com and www | 301 to https://thedoormanfallacy.com, path kept |

Steps:
1. Add both zones to Cloudflare.
2. At GoDaddy, change both domains' name servers to the pair Cloudflare gives. Only Jan can do this.
3. Add the redirect rules in Cloudflare.
4. Attach thedoormanfallacy.com to the Worker as a custom domain.

## Release

One command, `npm run release`. It stops at the first failing step.

1. Fast checks: lint, types, unit tests, copy, docs and case checks.
2. Build `dist/` once.
3. Site tests against that `dist/`.
4. Apply pending D1 migrations, after a dry run.
5. `wrangler deploy --dry-run`, then `wrangler deploy` with the same `dist/`.

To undo: `wrangler rollback` returns the previous Worker and site. A migration is undone by a new migration. The release command prints both before it acts.

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
