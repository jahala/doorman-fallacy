# The Doorman Fallacy

TheDoormanFallacy.com explains Rory Sutherland's doorman fallacy and keeps a sourced ledger of what happened after companies cut roles for AI. DoormanFallacy.com redirects to it. Jan Hallvard Larsen is the named curator.

## What the site is for

- The idea: one clear, citable explanation of the fallacy, with full credit to Sutherland (*Alchemy*, 2019).
- The ledger: one case per company, kept by AI agents under fixed rules ([D-009](docs/decisions.md)). What was cut, the visible task that was automated, what it missed, what was reported afterwards, and a date to look again. Most coverage stops on the day of the cut; the follow-up is what this site adds.
- Two printable checklists: one for a person whose role is being reviewed, one for a manager about to automate a role.
- A form where readers suggest cases or report errors.
- A sign-up for a letter, sent once there are subscribers.

## Stance and tone

Pro-judgment. Use AI where it does the job, and count everything the person did before cutting them. The site serves workers and managers alike.

The tone is calm and kind to everyone involved, including the managers who made the cut. No gloating when a company reverses. Cuts that held up are recorded as faithfully as reversals, because a ledger of failures only is advocacy and readers can tell.

## Hard rules

- Every factual sentence in a case rests on a verbatim quote from an archived source.
- Write what was reported. Never state or guess a company's motives.
- Rory Sutherland is credited wherever the idea is explained.
- Photographers are credited wherever their photos appear.
- No em dashes in site copy.
- No client-side JavaScript ships. Forms are plain HTML posting to the Worker.
- Personal data and unconfirmed leads live only in D1, never in this repository, and are deleted on the schedule in [docs/data-model.md](docs/data-model.md#d1).

Each rule's guard: [docs/engineering.md](docs/engineering.md#rules-and-their-guards).

## Where things live

| Topic | Doc |
|---|---|
| Parts, dependencies, where logic lives | [docs/architecture.md](docs/architecture.md) |
| How code is written and tested; every rule's guard | [docs/engineering.md](docs/engineering.md) |
| Ledger case format, vocabularies, retention | [docs/data-model.md](docs/data-model.md) |
| Domains, release, the weekly job, email | [docs/operations.md](docs/operations.md) |
| How the desk finds and assesses cases | [docs/desk.md](docs/desk.md) |
| Visual reference and tokens | [docs/design.md](docs/design.md) |
| Decisions, dated and numbered | [docs/decisions.md](docs/decisions.md) |
| Mockups | [docs/design-reference/](docs/design-reference/) |

## Commands

| Command | What | When | Time (2026-10-19) |
|---|---|---|---|
| `npm run check` | Types, lint, unit tests, Worker tests, copy, docs and case checks | Every change; the pre-push hook runs it | 17 s |
| `npm run build` | The static site into `dist/` | Before site tests and release | 3 s |
| `npm run test:worker` | The Worker's tests, part of `npm run check`; run alone while working on `src/worker/` | Every change to the Worker, `migrations/` or `wrangler.jsonc` | 1 s |
| `npm run test:site` | Browser checks against `dist/`, including the print test | Every change to pages, styles or components | 14 s |
| `npm run test:size` | Builds 500 generated cases and holds the ledger page to its budget | Changes to the ledger page, the case schema or `src/lib/` | 8 s |
| `npm run dev:worker` | The site and the form routes on http://localhost:8787, with a local database | Working on the forms ([operations](docs/operations.md#running-the-worker-locally)) | |

The whole suite runs in about 30 seconds, so every run is a full run; there is no changed-only selection. CI runs the same three once the repository is public. Node's major version comes from `.nvmrc`, and a test fails with the switch command when another is running.

## How cases are added

The desk adds them: a weekly run of agents that finds leads, drafts cases, checks them and publishes what passes ([docs/operations.md](docs/operations.md#the-desks-weekly-run)). The case format and what counts as a case: [docs/data-model.md](docs/data-model.md). The checks a case must pass: [docs/engineering.md](docs/engineering.md#publishing-checks).
