# Data model

Two stores:

- **Cases**, in the public repository: one Markdown file per published case.
- **D1**, private: leads, suggestions and subscriber addresses.

## A case

One file in `src/content/cases/`, named `<company>-<year>.md`. The schema in `src/data/case-schema.ts` is the source of truth; this doc explains it ([D-010](decisions.md)).

A case is a living record. Agents add updates, record each review, and correct facts, and the page shows all of it.

```yaml
company: Commonwealth Bank of Australia
short: Commonwealth Bank          # name shown in the ledger table
country: AU                       # ISO 3166 code; the display name comes from Intl
area: Customer service
change: 45 roles cut for a voice bot.        # at most 60 characters
announced: 2025-07-29
headcount: 45                     # null when not disclosed

door: Answering inbound calls     # the visible task that was automated

claims:                           # what the organisation said the change would do
  - date: 2025-07-29
    who: Commonwealth Bank
    said: The voice bot would reduce call volumes.
    source: union-2025-08
    quote: "..."                  # verbatim from the source

missed:                           # the doorman reading: analysis, tied to evidence
  - function: slack               # id from the hidden-function vocabulary
    evidence: Call volumes rose, and team leaders were answering calls.
    sources: [union-2025-08]

updates:                          # status changes, oldest first, at least one
  - date: 2025-08-21
    status: reversed
    summary: Bank calls the cut an error and reverses it.   # at most 80 characters
    sources: [acs-2025-08]
    quote: "..."                  # verbatim from the source

corrections:                      # factual fixes, shown on the page
  - date: 2026-11-02
    what: Headcount corrected from 90 to 45 direct-banking roles.

suggestedBy: null                 # a reader's name, only if they asked to be credited
lastChecked: 2026-10-19           # the latest review, whether or not it found news
nextReview: null                  # optional override of the derived date

watch:                            # what the review agent searches for
  queries: ["Commonwealth Bank voice bot", "CBA customer service jobs AI"]
  signals: [rehiring, call volumes, union statements, regulator action]

sources:                          # one list; everything above cites by id
  - id: acs-2025-08
    kind: reporting               # primary (company, union, court, filing) or reporting
    url: https://ia.acs.org.au/...
    publisher: ACS Information Age
    title: CBA reverses AI-driven job cuts, admits error
    published: 2025-08-21
    archive: https://web.archive.org/...

related: []                       # other cases about the same organisation
```

The values above illustrate the format. Real cases are checked against their sources.

### The body

Plain Markdown with these headings, in this order:

```md
## The role
## The change
## What happened next
## Open questions
```

Every factual sentence ends with a footnote keyed by source id, and the footnote carries the verbatim quote the sentence rests on:

```md
The bank said the roles were not redundant after all.[^acs-2025-08]

[^acs-2025-08]: "did not adequately consider all relevant business considerations"
```

### Two layers

Everything except `missed` is **reported**: it says what sources say, and each piece carries its quote. `missed` is **the doorman reading**, the site's analysis. The page labels it as analysis, and each point names the reported evidence it rests on.

## What counts as a case

A case needs all three:

1. A named organisation.
2. Roles reduced: layoffs, contracts ended, or posts left unfilled on purpose.
3. The organisation, or credible reporting, attributing the reduction to AI or automation, backed by one primary source or two independent reports.

Excluded: rumours, single anonymous posts, forecasts, and cuts with no named organisation. When reporting questions a company's AI attribution, the case records both as reported, with no conclusion about motives. A second cut by the same organisation is a new case, linked through `related`.

## Derived, never stored

- The current status is the status of the latest update. The ledger's "Reported outcome" column is the latest update's summary.
- The next review date comes from the latest status and its date, unless `nextReview` overrides it. Computed in `lib/review.ts`:

| Latest status | Next review |
|---|---|
| Too early to tell | 3 months |
| Strained | 3 months |
| Holding | 6 months, then yearly |
| Partly reversed | 6 months |
| Reversed | 12 months, then closed unless news arrives |

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

## Changes to a case

- A new development is a new update. Old updates are never edited.
- A wrong fact is fixed in place and recorded in `corrections`. The commit message says what changed and why.
- Each case page links to its history in the public repository ([D-004](decisions.md)).

A change to the case format changes the schema and every case in the same commit. The build validates every case, so a half-done change cannot ship.

## D1

Schema steps live in `migrations/`, numbered. An applied step is never edited; a change is a new step.

| Table | Holds | Kept until |
|---|---|---|
| `leads` | Items the sweep found: URL, title, outlet, date, triage label and reason | Published or rejected; then only the URL stays in `seen` |
| `seen` | URLs already triaged, so they are not triaged twice | One year after last seen |
| `suggestions` | Form entries: links, note, name, email, credit wish, triage label | Name and email deleted 90 days after the suggestion is resolved; the rest kept as a lead |
| `subscribers` | Address, confirmed or not, token, dates | Unconfirmed: 7 days. Confirmed: until unsubscribe, which deletes the row |
| `runs` | Each desk run: start, end, counts, failures | One year |

A scheduled Worker job deletes what has passed its time each day.

## Retention of cases

Cases are kept for as long as the site exists; they are the record. A case is removed only if it should never have been published, and the commit says why. The ledger is tested at 500 cases ([engineering.md](engineering.md)).
