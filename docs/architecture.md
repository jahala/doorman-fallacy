# Architecture

A static site. Astro builds HTML from Markdown case files at build time, and a Cloudflare Worker serves the result as static assets. Nothing runs on the server, and nothing stores personal data. The newsletter form posts straight to Buttondown ([D-003](decisions.md)).

## Parts

```
src/
  content/cases/        Ledger cases, one Markdown file each
  content.config.ts     The case schema; the build fails on a case that breaks it
  data/                 Vocabularies: hidden functions, case statuses
  lib/                  Pure functions: current status, review dates, sorting, contrast
  components/           Astro components
  layouts/              Page shells: Site now; Case and Print arrive with their pages
  pages/                Routes (below)
  styles/               tokens.css, base.css, print.css
src/assets/photos/      Photographs; fonts come from the @fontsource package
scripts/                Command-line tools: review-due, check-docs, check-copy, release
tests/
  unit/                 lib/ and the scripts
  e2e/                  Playwright against the built site
  fixtures/             Cases that must fail, files that lint must flag, the size fixture
wrangler.jsonc          Static assets only; no Worker script
```

## What may depend on what

```
pages → layouts → components → lib → data
content.config.ts → data
scripts → lib, data
```

- `lib/` is pure. It takes cases and dates as arguments and returns values. It never reads files, the clock or the network. A lint rule holds this ([engineering.md](engineering.md#rules-and-their-guards)).
- The edges supply I/O. Astro reads the case files and passes them to `lib/`. The scripts read files and take today's date as an argument.
- The site and the review job ask the same question ("which cases are due for review?"). Both call the same function in `lib/review.ts`, so the answer has one home.

## Routes

| Path | Page | Mockup |
|---|---|---|
| `/` | Home: hero, what else was the person doing, ledger preview, checklists, sign-up | all five |
| `/idea` | The full explanation, with the hidden functions | 1, 2 |
| `/ledger` | Every case, newest first | 3 |
| `/ledger/<slug>` | One case: narrative, update history, sources, next review | none yet |
| `/checks/your-hidden-job` | Printable checklist for a person whose role is reviewed | 4 |
| `/checks/before-you-cut` | Printable checklist for a manager automating a role | 4 |
| `/about` | The curator | none yet |
| `/sources` | Sources and approach: how cases are chosen, sourced, corrected | none yet |
| `/privacy` | What is collected (email, by Buttondown) and what is not | none yet |

"Suggest a case" is a `mailto:` link to an address routed by Cloudflare Email Routing ([operations.md](operations.md)).

## Outside the site

| Service | What it does | Data it holds |
|---|---|---|
| Cloudflare | DNS, redirect from DoormanFallacy.com, static hosting, email routing, cookieless analytics | No personal data from the site |
| Buttondown | Sign-up, confirmation, sending, unsubscribe | Subscriber emails |
| GitHub | Code, case history, CI, the weekly review job | Public case history ([D-004](decisions.md)) |
| Wayback Machine | Archived copies of sources | Public pages only |

## Later, when its trigger arrives

- A collection flow that finds candidate cases in the news. If it makes paid model calls, they go through one budgeted door. Its output is a draft case for Jan to approve; it never publishes.
- Ledger filters by status or sector, once the ledger passes about 50 cases.
- Interactive checklists, if people use the printable ones.
