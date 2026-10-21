# The desk

How the desk finds cases. The weekly routine around it is in [operations.md](operations.md#the-desks-weekly-run); what counts as a case is in [data-model.md](data-model.md#what-counts-as-a-case).

## The funnel

Most AI layoff news is not a doorman case. Many large cuts fund AI investment or restructure a company, and AI does not take over the cut roles' work, so there is no automatic door. A doorman case needs AI doing a role's visible task. The desk narrows the news in stages, cheapest first:

| Stage | Who | Cost | Does |
|---|---|---|---|
| 1. Sweep | Code, and DeepSeek search | $0.00075 per DeepSeek search; the rest free | Fetches news searches (`desk/queries.ts`) from Google News, GDELT, Hacker News and DeepSeek; merges duplicates |
| 2. Triage | Jev | Fractions of a cent per lead | Judges each headline: is it a named organisation's AI-linked reduction, what kind of news, how AI relates to the roles, which roles, which organisation, how many |
| 3. Priority | Code | Free | Weighs Jev's answers into a doorman priority (`doormanPriority` in `desk/triage.ts`) and groups leads by organisation |
| 4. Assessment | Claude agent | About $0.20 per organisation | Researches the lead and rates its doorman fit from 0 to 3, using `desk/prompts/assess.md` |
| 5. Drafting | Claude agent | About $0.20 per case | Writes the case from the sources' numbered sentences (`desk/prompts/draft.md`), citing sentences by number; code copies each cited sentence in as the quote |
| 6. Checks | Jev and code | Under $0.001 per case | The [publishing checks](engineering.md#publishing-checks); failures go back to the writer once, then are removed |

Commands:

```sh
node desk/sweep.ts --size full --days 30 --sources gnews,gdelt,hn,deepseek --budget 0.30
node desk/assess.ts --top 4 --budget-each 0.35 --budget 1.50
node desk/draft.ts --assessment .desk-runs/<run>/assessments/<org>.json --budget 1.50 --publish
```

A backfill looks further back for named organisations. Each `--query` replaces the standard searches; Google News accepts windows of years. A prefix picks the edition: `no:`, `sv:` or `da:`, and English without one:

```sh
node desk/sweep.ts --days 1100 --sources gnews --budget 0.30 --query 'Klarna AI assistant customer service staff' --query '...'
node desk/assess.ts --only 'klarna,salesforce' --top 2 --budget 1.00
```

The first backfill (2026-10-21) searched ten organisations. The assessor rated four for drafting. Three passed every check: CBA, Klarna and Salesforce. Duolingo stopped at the quote check, because one cited sentence was not on the archived copy of its source. IBM was rated watch, and Atlassian and Lufthansa were rejected, because no source names the tasks AI took over.

The second backfill (2026-10-21) added Nordic searches and European banks. ING (anti-money-laundering checks) and Duolingo were published. Duolingo had stopped at the quote check twice because of a bug, not the source: a tag between a link and the full stop left a space behind ("filings ."), so the quote did not match. The match now drops spaces next to punctuation on both sides (`src/lib/quotes.ts`). Allianz Partners was rated watch. Telenor was rejected only because its Norwegian stories could not be opened through Google News' redirect links; it is worth a search by hand. Göteborgs-Posten, Commerzbank, Danske Bank and Paf were rejected, because no source names the work AI took over.

## DeepSeek search (2026-10-21)

Google News gives each story as a redirect link. Fetching one returns a page of script with no publisher address, so the assessor could not open Telenor's Norwegian coverage. DeepSeek's Search API returns each result's real address, publisher and date, takes `lang:` and `after:` operators, and costs $0.00075 per search that finds something. `desk/deepseek.ts` is its door: each request reserves its price against the run's budget, an empty or refused request is settled at nothing, and a request with no answer is counted as possibly charged and not resent. The key is `DEEPSEEK_API_KEY`, from the environment or the Keychain item Conductor keeps it in.

The same seven Nordic searches through DeepSeek alone gave 135 leads with publisher addresses, and four new organisations the Google News round had not surfaced: Telenor Norge with 16 reports, Dinero, Intrum and Uber. Telenor's own press release, a primary source, was among them. The assessor rated Telenor, Dinero and Intrum watch and rejected Uber. Results include low-quality machine-translated aggregators, so the assessor still filters.

`node desk/search.ts 'query lang:no after:2024-01-01'` searches by hand; `--fetch <url>` returns a page as Markdown, with its punctuation escaped (`\.`), so text from it is not yet used for quote checks.

`node desk/weekly.ts --budget 3` runs every stage in order ([operations.md](operations.md#the-desks-weekly-run)). Each command takes a `--budget` in dollars for the whole run. Every Jev and Claude call reserves its most possible cost against it before it starts, and a call that would pass it is refused (`desk/budget.ts`). Stopping a command with Ctrl-C stops the Claude processes it started.

Archiving uses Save Page Now with Jan's archive.org keys, read from the Keychain (service `archive.org`, accounts `s3-access` and `s3-secret`) at the moment of use. Without them, anonymous saving is tried, and it often fails.

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

## What the first drafting run showed (2026-10-19)

The DNB case went from assessment to a published case file in under a minute, for $0.17 to $0.29 of Claude and under $0.001 of Jev per run.

| Finding | Consequence |
|---|---|
| The release's text sat in a `<pre>` block inside a Next.js data block, so paragraph extraction found 2 sentences | `articleSentences` also reads `<pre>`, `articleBody` in structured data, and article HTML in Next.js data, and keeps whichever gives the most sentences |
| Given only the quote, Jev failed true statements that named the publisher or the date ("DNB said ...", "On 6 October ...") | Jev now sees the source's publisher, date and kind with each quote. First-draft failures fell from 5 of 12 to 1 of 12 |
| One revision round fixed every remaining failure in two of three runs; in the third, the update could not be supported and the case was not published | The pipeline fails closed: a case without a supported update or doorman reading is never written to `src/content/cases/` |
| All quotes in the published case were found on the archived copy | Publishing check 2 holds when quotes are copied by code |
| The only readable source was DNB's own release; Norwegian coverage was blocked or never searched | Add Norwegian and other Scandinavian searches to the sweep, and use Wayback copies for blocked publishers |

## Nordic searches and name merging (2026-10-19)

The sweep now runs Norwegian, Swedish and Danish searches in each language's own Google News edition (`desk/queries.ts`). In the first run they found about a dozen Norwegian reports on DNB that the English searches missed, including the finance union Finansforbundet criticising the cut. Jev's headline triage handled Norwegian and Swedish headlines as well as English ones.

Name variants now merge into one group (`sameOrganisation` in `src/lib/leads.ts`): "DNB", "DNB Bank" and the Scandinavian possessive "DNBs" became one group of 21 reports. Headlines that name no organisation but report a reversal or its aftermath now go to the assessor too.

Much Norwegian business coverage is behind paywalls (marked "(+)" in headlines). The assessor does not rely on a headline it could not open, so paywalled follow-ups appear as things to watch for rather than as reported facts. GDELT refusals are now retried after 10, 20 and 40 seconds.

## Junior intake (2026-10-21)

A sweep for organisations hiring fewer juniors, graduates or interns because of AI (15 searches in English, Norwegian, Swedish and Danish, two years) gave 738 leads. Of eight assessed, MinterEllison, an Australian law firm that cut its graduate intake by a third as AI took over junior document review, was rated watch: no firm statement was found. The rest were rejected. For PwC UK, KPMG UK, Deloitte UK and Wipro the reasons given were the economy, low attrition or weak demand, and the AI link was commentary. Anthropic's reported fall in junior posts is described as correlation, with redeployment first. Most coverage of junior hiring and AI is trend reporting rather than a named organisation linking its own intake to AI.

The assessor reads "roles reduced" as existing roles. The inclusion rule also counts posts left unfilled on purpose, which covers junior intake; if junior cases become a category, the assessment prompt should say so.

Two fixes came from these runs. The assessor now puts reports with a direct publisher address ahead of Google News redirect links (`readableFirst` in `desk/clusters.ts`). An assessment whose answer is malformed, such as a source with no quote, now fails for that organisation alone, keeping what it cost, instead of stopping the run.

