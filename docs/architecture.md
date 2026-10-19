# Architecture

Three parts:

1. **The site.** Astro builds static HTML from the case files. It ships no client-side JavaScript.
2. **The Worker.** It serves that HTML and answers three form routes: suggest a case, subscribe, confirm. It stores what the forms send in a private D1 database.
3. **The desk.** A weekly run of AI agents on Jan's Mac. It finds leads, writes and checks cases, reviews old ones, and publishes what passes ([D-009](decisions.md)).

Personal data (suggestions, subscriber addresses) lives only in D1. Leads, which are unconfirmed claims about named companies, also live only in D1. The public repository holds published cases only.

## Parts

```
src/
  content/cases/        Published cases, one Markdown file each
  content.config.ts     Loads cases through the schema; the build fails on a case that breaks it
  data/                 Vocabularies and the case schema
  lib/                  Pure functions shared by the site, the Worker and the desk
  components/           Astro components
  layouts/              Page shells: Site now; Case arrives with its page. The printable guides are Site pages built from ChecklistPage, which holds their print styles
  pages/                Routes (below)
  styles/               tokens.css, base.css, print.css
  worker/               The Worker: form routes, D1 access, mail through cfmail
src/assets/photos/      Photographs; fonts come from the @fontsource package
migrations/             D1 schema steps, numbered, never edited once applied
desk/                   The weekly run: sweep, triage, assess, draft, check, publish, review, report ([desk.md](desk.md))
scripts/                Command-line tools: check-docs, check-copy, check-cases, release
tests/
  unit/                 lib/, the scripts, the Worker's handlers
  e2e/                  Playwright against the built site
  fixtures/             Cases that must fail, files that lint must flag, the size fixture
wrangler.jsonc          Static assets plus the Worker script and its D1 binding
```

## What may depend on what

```
pages → layouts → components → lib → data
worker → lib → data
desk → lib → data
scripts → lib, data
```

- `lib/` is pure. It takes data and dates as arguments and returns values. It never reads files, the clock or the network. A lint rule holds this ([engineering.md](engineering.md#rules-and-their-guards)).
- The edges supply I/O. Astro reads the case files. The Worker reads requests and D1. The desk reads feeds, archives, D1 and the repository. Each passes today's date in.
- A rule two parts both apply has one home in `lib/`. The site and the desk both ask "which cases are due for review?" and both call `lib/review.ts`. The Worker and the site both validate a suggestion through the same schema.

## Routes

| Path | Page | Mockup |
|---|---|---|
| `/` | Home: hero, what else was the person doing, ledger preview, checklists, sign-up | all five |
| `/idea` | The full explanation, with the hidden functions | 1, 2 |
| `/ledger` | Every case, newest first | 3 |
| `/ledger/<slug>` | One case: reported facts, the doorman reading, timeline, sources, changelog | none yet |
| `/checks/your-hidden-job` | Printable checklist for a person whose role is reviewed | 4 |
| `/checks/before-you-cut` | Printable checklist for a manager automating a role | 4 |
| `/suggest` | Suggest a case or report an error | none yet |
| `/about` | The curator | none yet |
| `/approach` | How the ledger is kept: the AI agents, the inclusion rule, the checks, corrections | none yet |
| `/privacy` | What is collected, why, and when it is deleted | none yet |
| `/rss.xml` | New cases and updates | |

Form routes, answered by the Worker:

| Route | Does |
|---|---|
| `POST /api/suggest` | Stores a suggestion; redirects to a thank-you page |
| `POST /api/subscribe` | Stores an unconfirmed address; sends the confirmation email |
| `GET /confirm?token=` | Confirms the address |
| `GET /unsubscribe?token=` and `POST` | Deletes the address (the POST is the one-click unsubscribe) |

## Outside the site

| Service | What it does | Data it holds |
|---|---|---|
| Cloudflare | DNS, redirects, the Worker, D1, cookieless analytics | Suggestions and subscriber addresses, in D1 |
| cfmail | Sends the confirmation email and the desk's weekly report, through a service mailbox ([D-008](decisions.md)) | Copies of mail it sent |
| Claude Code | Runs the desk's agents on Jan's subscription | Nothing kept |
| Wayback Machine | Archived copies of sources | Public pages only |
| GitHub | Code and the public history of every case ([D-004](decisions.md)) | Published cases |

## Later, when its trigger arrives

- A sender for the monthly letter, once there are subscribers and something to send ([D-008](decisions.md)).
- Ledger filters by status or sector, once the ledger passes about 50 cases.
- Notes: essays on patterns across cases, once there are about 20 cases.
- Interactive checklists, if people use the printable ones.
