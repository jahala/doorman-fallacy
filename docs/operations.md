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

These exist only in Cloudflare and cfmail, so nothing in the repository can make them. Each says how to undo it. Everything is in Jan's Cloudflare account (`182eab…`, the one cfmail uses), pinned as `account_id` in `wrangler.jsonc`. `scripts/release.sh` also exports it, because `wrangler d1 migrations` ignores the config's `account_id` and stops when the login reaches more than one account.

1. **The D1 database.** Done 2026-10-21: `doorman-fallacy`, jurisdiction `eu`, its id in `wrangler.jsonc`. Its two migrations were applied on 2026-11-12, so the weekly run can read the suggestions table before launch; the release applies any later ones. To undo: `npx wrangler d1 delete doorman-fallacy`, then remove the id. That deletes every row, readers' suggestions and subscribers included.
2. **The mail domain.** Done 2026-10-21, following cfmail's AGENTS.md section 3: no MX record or other mail provider existed; Email Routing is on, its catch-all goes to the Worker `mail-surraura`, and Email Sending is on (bounce MX, SPF and the `cf2024-1` DKIM record are live). To undo: `wrangler email sending disable thedoormanfallacy.com`, set the catch-all back to drop, and `wrangler email routing disable thedoormanfallacy.com`.
3. **The domain in the cfmail app.** Done by Jan 2026-10-21 (signed in as admin at https://mail.surraura.com). Admin, Domains: add `thedoormanfallacy.com` with the kinds "service" and "group" ticked; the SPF, DKIM and DMARC badges turn green within a minute. Admin, Mailboxes: `hello` and `privacy` as group mailboxes owned by Jan, so mail to the addresses the site lists arrives. To undo: delete the mailboxes, then remove the domain.
4. **The service mailbox.** Done 2026-10-21: `noreply@thedoormanfallacy.com`, send-only, its key in the Keychain (service `doorman-fallacy`, account `CFMAIL_KEY`); `GET /api/svc/info` with it answers with that address. Admin, Service: the name `noreply`, the domain `thedoormanfallacy.com`, "send-only". The app shows the API key once; copy it and paste it nowhere. Then store it from the clipboard, so it never reaches the screen: `security add-generic-password -U -s doorman-fallacy -a CFMAIL_KEY -w "$(pbpaste)"`, and clear the clipboard. It waits in the Keychain until the first release, because `wrangler secret put` would create a placeholder Worker before the site is deployed. To undo: delete the service in Admin, Service, which stops its key at once, and `security delete-generic-password -s doorman-fallacy -a CFMAIL_KEY`.
5. **The repository public.** Done 2026-11-12, after its history was rebuilt in a new repository without the first About page's biography; the old one is private as `doorman-fallacy-archive`. The site links to GitHub for its code, its licence and each case's history, so the repository must be public before the first release, or those links show visitors a 404. To undo: make it private again.
6. **The secret and the custom domains, at the first release.** Done 2026-11-12: the registrar's records were deleted by Jan in the dashboard, since Wrangler's login cannot edit DNS, and the first release created the four custom domains. Before it: put the key into the Worker from the Keychain (`security find-generic-password -s doorman-fallacy -a CFMAIL_KEY -w | npx wrangler secret put CFMAIL_KEY`), and delete the apex and `www` A records in both zones, left from the registrar, because a custom domain refuses a hostname that has a record. The release then creates the four custom domains from `routes`, with their records and certificates. To undo: remove a domain in the Worker's Domains and Routes settings, or remove it from `routes` and release again.

The zone thedoormanfallacy.com also has a DMARC record from the registrar (`p=quarantine`, reports to `onsecureserver.net`). cfmail's guide leaves an existing DMARC record alone; pointing its reports elsewhere is Jan's call once sending has worked for a while.

After the first release, check that the Worker answers: the home page loads, `https://www.doormanfallacy.com/idea` redirects to `https://thedoormanfallacy.com/idea`, and a sign-up with Jan's own address delivers the confirmation email.

## Running the Worker locally

`npm run build`, then `npx wrangler d1 migrations apply doorman-fallacy --local`, then `npm run dev:worker`, which serves the site and the form routes on http://localhost:8787. The script passes `--local-upstream localhost:8787` because Wrangler otherwise shows the Worker the first custom domain as the request's host, and the Worker would redirect every page to https. The local database lives under `.wrangler/` and holds test data only. The confirmation email needs a `CFMAIL_KEY`; put one in `.dev.vars` (git ignores it) or leave it out, and a sign-up then fails at the mail step and shows the "did not go through" page. Never run `wrangler dev --remote`: it would use the real database.

## Form data

The suggest and subscribe routes hold their rate limit in D1, as a hash of the visitor's address ([D-016](decisions.md)); the daily job deletes those rows within a day. The daily job also deletes unconfirmed subscribers after 7 days and blanks names and emails on suggestions 90 days after they are resolved ([data-model.md](data-model.md#d1)). It logs counts only. To see that it ran, read the Worker's logs in the Cloudflare dashboard for a `retention` line.

## The desk's weekly run

`desk/weekly.ts` runs every Monday at 08:00 on Jan's Mac ([D-012](decisions.md), [D-028](decisions.md)). Its agents run in Claude Code on DeepSeek Flash ([D-021](decisions.md)); the key is `DEEPSEEK_API_KEY`, read from the environment or, under launchd, from the Keychain item Conductor keeps it in. How the desk narrows the news, follows up cases and what each stage costs: [desk.md](desk.md). Each run:

1. **Read** readers' open suggestions and error reports from D1, through `wrangler d1 execute --remote` (`desk/suggestions.ts`). Only a credited reader's name leaves D1, never an email address.
2. **Sweep** the last eight days of news, with each suggested link as a lead of its own.
3. **Set aside** organisations already in the ledger, and those assessed in the last 30 days (`.desk-runs/assessed.json`, entries kept 180 days).
4. **Assess** the strongest new leads, and every organisation a reader suggested.
5. **Draft and publish** each case the assessor recommends, suggested ones first, through the [publishing checks](engineering.md#publishing-checks). A reader who asked to be credited is named in `suggestedBy`.
6. **Review** every case in the ledger ([desk.md](desk.md#following-up-a-case)): readers' error reports, the week's news and readers' links about it, and a search of its watch queries since its last check. Cases with reports go first, then those with links, then those due by the schedule.
7. **Commit and push** what changed (the pre-push hook runs the checks), then mark each suggestion the desk looked at as resolved, with what it found. A suggestion the desk could not look at stays open for next week.
8. **Release** the site with `npm run release`, from the desk's worktree, which now matches master, so the week's changes go live. The release runs every check again and stops at the first failure, so a bad week never reaches the site; the report says whether it was released. Write the report to the run's folder and post a Mac notification. A run with any failure says so in the notification and exits non-zero.

Each stage runs as its own process. Sweep, assessments and drafts have fixed shares of the week's budget (default $3); reviews share what those leave, at most $0.30 each, so the total cannot pass it. The report will also go to Jan by email once thedoormanfallacy.com is set up in cfmail.

Install the schedule with `scripts/install-desk-schedule.sh`. It runs the desk from its own worktree (`df-desk` beside the repository), detached at origin/master, so the weekly commit never lands in a checkout someone is editing and the main checkout can keep master. Each run moves that worktree to origin/master and pushes its commit to master. The script prints how to undo itself before it acts. If the Mac is asleep at 08:00, launchd runs the job when it wakes, and the report marks the run as late when more than seven days have passed. Each run overwrites `.desk-runs/last-run.log` in that worktree.

To take a case down: delete its file in one commit that says why, and release.
## Site health

`.github/workflows/site-health.yml` ([D-012](decisions.md)) fetches the home page and both redirects each day at 06:17 UTC, and GitHub emails Jan when one fails. It runs separately from the desk, so a sleeping Mac cannot hide a broken site. Run it by hand from the repository's Actions tab (Site health, Run workflow).

## Email

cfmail sends the site's mail through a service mailbox, `noreply@thedoormanfallacy.com` ([D-008](decisions.md)). Setup follows cfmail's AGENTS.md, section 3 (add the domain) and section 5.5 (service mailbox). The key goes straight into the Worker's secrets as `CFMAIL_KEY` and is never shown.

| Mail | When |
|---|---|
| Confirm your subscription | On sign-up |
| The desk's weekly report | After each run, to Jan |

The monthly letter is not sent through cfmail. Cloudflare Email Sending allows only transactional mail, and a review of the account would pause sending for every project on cfmail. The letter's sender is chosen when there are subscribers and something to send.

## Analytics

Our own cookieless analytics on Cloudflare, in the EU (D-024). Each page sends one page view to `e.thedoormanfallacy.com`, only from thedoormanfallacy.com and never under Do Not Track or Global Privacy Control. It sets no cookies and stores nothing in the browser, so the site needs no cookie banner. The privacy page says what is sent and kept. The token and hosts live in `src/data/visit-count.ts`.
