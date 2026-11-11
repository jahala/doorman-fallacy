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

missed:                           # the doorman reading: analysis, tied to evidence that the work went missing; may be empty
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

Every factual sentence ends with a footnote, and the footnote carries the verbatim quote the sentence rests on. A footnote's label is the source id; when one source backs several sentences, later labels add `-2`, `-3` and so on:

```md
The bank said the roles were not redundant after all.[^acs-2025-08]

[^acs-2025-08]: "did not adequately consider all relevant business considerations"
```

### Two layers

Everything except `missed` is **reported**: it says what sources say, and each piece carries its quote. `missed` is **the doorman reading**, the site's analysis. The page labels it as analysis, and each point names the reported evidence it rests on. That evidence must report the hidden work going missing, getting worse, moving to others or landing on fewer people; that the work exists is not enough. Until a source reports that, `missed` is empty and the page says the ledger is still looking.

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

## The dataset

`/ledger.csv` and `/ledger.json` carry every case, newest announcement first. They are built with the site from the case files by `lib/dataset.ts`, so they are derived and never stored or edited. Each row is one case:

| Column | Holds |
|---|---|
| `slug` | The case's file name without `.md`, and the last part of its address |
| `url` | The case page, in full |
| `company`, `short`, `country`, `area`, `change`, `announced`, `headcount`, `door` | The case's own fields. `country` is the ISO 3166 code; `headcount` is empty (CSV) or null (JSON) when not stated |
| `status` | The current status id: the status of the latest update |
| `latest_update_date`, `latest_update_summary` | The latest update's date and summary |
| `missed` | The hidden function ids of the doorman reading. Joined by `;` in the CSV, an array in the JSON |
| `last_checked` | The latest review |
| `next_review` | Derived as above; empty (CSV) or null (JSON) when the case is closed |
| `sources` | How many sources the case lists |

The CSV follows RFC 4180: a header row, CRLF line ends, UTF-8 with no byte order mark, and quotes around any value with a comma, a quote or a line break. The JSON is `{ "licence": "CC BY 4.0", "credit": "The Doorman Fallacy, thedoormanfallacy.com", "cases": [...] }`. The column names are fixed: others build on them, so a rename is a decision.

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

Hidden functions (the work an automated task leaves behind). Each entry in `src/data/hidden-functions.ts` also holds the text of its entry on `/idea` (anchored `/idea#<id>`): `today` (an illustration, not a reported case) and `whenMissing`. The definition and its citation are in `src/data/definition.ts`; the six signs to watch after an announcement are in `src/data/signs.ts`; the three questions, with the research behind each and the signs that a decision skipped it, are in `src/data/questions.ts`.

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

Schema steps live in `migrations/`, numbered. An applied step is never edited; a change is a new step. The database is `doorman-fallacy`, bound to the Worker as `DB`. Times are ISO 8601 UTC text, so they sort as text.

| Table | Holds | Kept until |
|---|---|---|
| `leads` | Items the sweep found: URL, title, outlet, date, triage label and reason | Published or rejected; then only the URL stays in `seen` |
| `seen` | URLs already triaged, so they are not triaged twice | One year after last seen |
| `suggestions` | Form entries: links, note, name, email, credit wish, triage label | Name and email blanked 90 days after the suggestion is resolved; the rest kept as a lead |
| `subscribers` | Address, confirmed or not, token, dates | Unconfirmed: 7 days after the last confirmation email. Confirmed: until unsubscribe, which deletes the row |
| `runs` | Each desk run: start, end, counts, failures | One year |
| `rate_hits` | One row per form attempt, under a hash of the form and the visitor's address, to hold the limit of 5 an hour | Counts for one hour; deleted by the daily job |

A scheduled Worker job runs daily at 03:17 UTC and deletes what has passed its time. The cut-offs come from `cutoffs` in `src/lib/limits.ts`, which takes today's date as an argument; a year is 365 days. The job leaves `leads` to the desk.

The suggestion's `case_slug` column would be called `case` if it were not an SQL keyword. Name and email are set to null, never to an empty string, when blanked.

### `suggestions`

| Column | Holds |
|---|---|
| `id` | Row number |
| `created_at` | When the form arrived |
| `kind` | `case` for a suggested case, `error` for an error report |
| `case_slug` | The case an error report is about; null for a suggested case. An error report must have one |
| `links` | A JSON array of up to five http or https URLs; empty for an error report with no link |
| `note` | What the sender wrote, at most 2000 characters, line breaks as `\n`; empty when nothing was written |
| `name` | The sender's name, at most 100 characters; null when not given or after it is blanked |
| `email` | The sender's address, lower case; null when not given or after it is blanked |
| `credit` | 1 when the sender asked to be credited by name, else 0 |
| `triage_label` | The desk's label; null until triaged |
| `resolved_at` | When the desk finished with the suggestion; null until then. The 90 days run from here |

### `subscribers`

| Column | Holds |
|---|---|
| `id` | Row number |
| `email` | The address, lower case; one row per address |
| `token` | 32 random bytes as 64 hex characters. It confirms the address, then unsubscribes it. It is replaced when the confirmation email is sent again |
| `created_at` | When the address first signed up |
| `token_sent_at` | When the current token was emailed. A link works for 7 days from here, and a new email waits 10 minutes from here |
| `confirmed_at` | When the link was followed; null while unconfirmed |

### `rate_hits`

| Column | Holds |
|---|---|
| `id` | Row number |
| `key` | SHA-256 of the form kind and the visitor's address, as hex. The address itself is not kept, though an address can be guessed from its hash, so this is treated as personal data and kept for under a day |
| `hit_at` | When the attempt was made |

### `leads`

| Column | Holds |
|---|---|
| `id` | Row number |
| `url` | The article's address; one row per address |
| `title` | The headline |
| `outlet` | The publisher; null when unknown |
| `published` | The publication date as the feed gave it; null when unknown |
| `found_at` | When the sweep found it |
| `triage_label` | The triage verdict; null until triaged |
| `triage_reason` | Why; null until triaged |
| `state` | `open`, `published` or `rejected` |

### `seen`

| Column | Holds |
|---|---|
| `url` | The address already triaged; the primary key |
| `last_seen_at` | When the sweep last met it. The year runs from here |

### `runs`

| Column | Holds |
|---|---|
| `id` | Row number |
| `started_at` | When the run began. The year runs from here |
| `ended_at` | When it finished; null if it stopped part-way |
| `counts` | A JSON object of counts: leads found, drafted, published and so on |
| `failures` | A JSON array of what went wrong |

## Retention of cases

Cases are kept for as long as the site exists; they are the record. A case is removed only if it should never have been published, and the commit says why. The ledger is tested at 500 cases ([engineering.md](engineering.md)).
