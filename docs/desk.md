# The desk

How the desk finds cases. The weekly routine around it is in [operations.md](operations.md#the-desks-weekly-run); what counts as a case is in [data-model.md](data-model.md#what-counts-as-a-case).

## The funnel

Most AI layoff news is not a doorman case. Many large cuts fund AI investment or restructure a company, and AI does not take over the cut roles' work, so there is no automatic door. A doorman case needs AI doing a role's visible task. The desk narrows the news in stages, cheapest first:

| Stage | Who | Cost | Does |
|---|---|---|---|
| 1. Sweep | Code | Free | Fetches news searches (`desk/queries.ts`) from Google News, GDELT and Hacker News; merges duplicates |
| 2. Triage | Jev | Fractions of a cent per lead | Judges each headline: is it a named organisation's AI-linked reduction, what kind of news, how AI relates to the roles, which roles, which organisation, how many |
| 3. Priority | Code | Free | Weighs Jev's answers into a doorman priority (`doormanPriority` in `desk/triage.ts`) and groups leads by organisation |
| 4. Assessment | Claude agent | About $0.20 per organisation | Researches the lead and rates its doorman fit from 0 to 3, using `desk/prompts/assess.md` |
| 5. Drafting | Claude agent, then Jev | Not built yet | Writes the case; quotes are selected from the fetched page, never written |
| 6. Checks | Code and a second agent | Not built yet | The [publishing checks](engineering.md#publishing-checks) |

Commands:

```sh
node desk/sweep.ts --size full --days 30 --sources gnews,gdelt,hn --budget 0.30
node desk/assess.ts --top 4 --budget-each 0.35
```

Runs are written to `.desk-runs/`, which git ignores, because leads are unconfirmed claims about named companies. The sweep moves runs older than 30 days to the Trash.

## Why each stage asks what it asks

- **Jev selects, code finds.** Jev is weak at reading numbers and long lists of names out of text. Code finds every capitalised name and every number in a headline, and Jev picks the organisation and the headcount from those candidates. `src/lib/leads.ts` holds the candidate finders.
- **Mechanism decides more than size.** A cut of 30,000 that funds AI investment scores below a cut of 45 where a voice bot answers the calls. `mechanismWeight` gives "AI does the roles' work" full weight and "cuts fund AI" little.
- **Roles that deal with people carry the most hidden work.** `roleWeight` ranks customer-facing roles first.
- **The assessor rates the question, not the outcome.** A change that holds up is as useful to the ledger as one that fails. The assessor rates how clearly a case shows "what else was the person doing?"
- **Quotes are checked against the page.** `src/lib/quotes.ts` matches a quote word for word against the fetched page, ignoring only markup, case, spacing and typographic marks.

## What the first test showed (2026-10-19)

Small run: 3 searches, Google News, 7 days. 69 leads, Jev triage in 3 seconds for $0.004. Large run: 13 searches, three sources, 30 days. 537 leads after merging, Jev triage in 22 seconds for $0.034. Six assessments cost $1.14, between 32 and 108 seconds each.

| Finding | Consequence |
|---|---|
| Jev's headline judgments matched a hand review on the question asked. Its misses were headlines that name no organisation | Leads marked as reversals or aftermath with no organisation named go to the assessor anyway |
| Headlines rarely say which roles were cut or whether AI does their work; most came back "vague" and "mixed" | The assessor, which reads the articles, makes the doorman judgment |
| The assessor rejected cuts where AI is only mentioned, and recommended a case where the company's own release names the tasks AI agents took over | The doorman filter works at this stage |
| About half of the assessor's "verbatim" quotes were not word for word on the page; one changed "says" to "said" | Quotes must be selected from the page's sentences by code and Jev, never written by the drafting agent |
| Some publishers refuse automated fetches (HTTP 403) | Fall back to the Wayback Machine copy for page text |
| GDELT refused most requests (HTTP 429) even at one request every 5.5 seconds | Retry GDELT with back-off |
| One organisation split into groups under name variants ("DNB" and "DNB Bank") | Merge names where one is the start of the other, or ask Jev whether two names are the same organisation |
| A plan to replace support staff with AI was dropped before any roles were cut; the assessor rejected it under the inclusion rule | Correct. The ledger finds cases where roles were cut and monitors them; plans dropped before a cut stay out (decided 2026-10-19) |
