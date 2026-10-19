# Data model

The ledger is the only stored data. Each case is one Markdown file in `src/content/cases/`, named `<company>-<year>.md`. The schema in `src/content.config.ts` is the source of truth; this doc explains it.

## A case

```yaml
company: Commonwealth Bank of Australia
short: Commonwealth Bank          # name shown in the ledger table
country: AU                       # ISO 3166 code; the display name comes from Intl
area: Customer service
change: 45 roles cut for a voice bot.        # at most 60 characters
announced: 2025-07-29
headcount: 45                     # null when not disclosed
door: Answering inbound calls     # the visible task that was automated
missed: [judgment, slack]         # ids from the hidden-function vocabulary, at least one
updates:                          # oldest first, at least one
  - date: 2025-07-29
    status: too-early
    summary: Roles cut as a voice bot takes inbound calls.   # at most 80 characters
    sources: [...]
  - date: 2025-08-21
    status: reversed
    summary: Bank calls the cut an error and reverses it.
    sources: [...]
nextReview: 2026-08-21            # required unless the latest status is reversed
```

The Markdown body is the narrative: what the role did, what the automation did, what was reported afterwards.

The values above illustrate the format. Each real case is checked against its sources before it is published.

## A source

```yaml
- url: https://example.com/article
  publisher: ACS Information Age
  title: CBA reverses AI-driven job cuts, admits error
  published: 2025-08-21
  archive: https://web.archive.org/web/...   # required
```

## Derived, never stored

- The current status is the status of the latest update. The ledger's "Reported outcome" column is the latest update's summary.
- Whether a case is due for review comes from `nextReview` and today's date, computed in `lib/review.ts`.

## Vocabularies

Each vocabulary is one file in `src/data/`. The schema, the pages and the docs read from it.

Statuses:

| id | Label | Meaning |
|---|---|---|
| `too-early` | Too early to tell | The cut is recent, or nothing has been reported since |
| `holding` | Holding | Reports say the change works as intended |
| `strained` | Strained | Reports of problems: complaints, overtime, quality falling |
| `partly-reversed` | Partly reversed | Some roles or human options restored |
| `reversed` | Reversed | The company undid the cut |

Hidden functions (the work an automated task leaves behind):

| id | Label | Meaning |
|---|---|---|
| `signal` | Signal | A person's presence tells customers they matter |
| `deterrence` | Deterrence | A person watching changes behaviour |
| `judgment` | Judgment | Spotting the case the script does not cover, and escalating it |
| `memory` | Memory | Knowing the regular, the history, the exception |
| `absorption` | Absorption | Taking anger or confusion so it does not land elsewhere |
| `slack` | Slack | Spare capacity that only shows in a crisis |

## Corrections

A wrong fact is fixed in place, and the commit message says what changed and why. With a public repository, each case page links to its history ([D-004](decisions.md)). A change of status is always a new update, never an edit to an old one.

## Changing the format

A change to the case format changes the schema and every case in the same commit. The build validates every case, so a half-done change cannot ship.

## Retention

Cases are kept for as long as the site exists; they are the record. A case is removed only if it should never have been published, and the commit says why. The ledger is tested at 500 cases ([engineering.md](engineering.md)).

Subscriber emails are held by Buttondown, never by this site. Buttondown deletes them on unsubscribe ([operations.md](operations.md#newsletter)).
