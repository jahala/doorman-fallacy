# The Doorman Fallacy

TheDoormanFallacy.com explains Rory Sutherland's doorman fallacy and keeps a sourced ledger of what happened after companies cut roles for AI. DoormanFallacy.com redirects to it. Jan Hallvard Larsen is the named curator.

## What the site is for

- The idea: one clear, citable explanation of the fallacy, with full credit to Sutherland (*Alchemy*, 2019).
- The ledger: one case per company. What was cut, the visible task that was automated, what it missed, what was reported afterwards, and a date to look again. Most coverage stops on the day of the cut; the follow-up is what this site adds.
- Two printable checklists: one for a person whose role is being reviewed, one for a manager about to automate a role.
- A short email when the ledger changes.

## Stance and tone

Pro-judgment. Use AI where it does the job, and count everything the person did before cutting them. The site serves workers and managers alike.

The tone is calm and kind to everyone involved, including the managers who made the cut. No gloating when a company reverses. Cuts that held up are recorded as faithfully as reversals, because a ledger of failures only is advocacy and readers can tell.

## Hard rules

- Every fact in the ledger has a linked source and an archived copy of it.
- Write what was reported. Never state or guess a company's motives.
- Rory Sutherland is credited wherever the idea is explained.
- Photographers are credited wherever their photos appear.
- No em dashes in site copy.
- No client-side JavaScript ships.

Each rule's guard: [docs/engineering.md](docs/engineering.md#rules-and-their-guards).

## Where things live

| Topic | Doc |
|---|---|
| Parts, dependencies, where logic lives | [docs/architecture.md](docs/architecture.md) |
| How code is written and tested; every rule's guard | [docs/engineering.md](docs/engineering.md) |
| Ledger case format, vocabularies, retention | [docs/data-model.md](docs/data-model.md) |
| Domains, release, the weekly job, email | [docs/operations.md](docs/operations.md) |
| Visual reference and tokens | [docs/design.md](docs/design.md) |
| Decisions, dated and numbered | [docs/decisions.md](docs/decisions.md) |
| Mockups | [docs/design-reference/](docs/design-reference/) |

## Commands

Written by /test-setup once the scaffold runs, with measured times. Nothing is measured yet.

## Adding a case

1. Create `src/content/cases/<company>-<year>.md` in the format in [docs/data-model.md](docs/data-model.md).
2. Archive every source on the Wayback Machine and record the archive link.
3. Run the checks. The build refuses a case that breaks the format.
4. Set the next review date.
