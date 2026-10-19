# Who the site is for, and what they need from it (2026-10-19)

**Conclusion (revised after round 2).** The site needs entry points by reader as well as by topic. People whose own job is at stake, leaders deciding, and people who build AI service each need a page written for their situation. That comes on top of round 1's findings: readers come for two things: the cases, and a way to think about their own decision. The site gives them the case table and three good questions, but it leaves out what most of them want next: **how to recognise the mistake**, **worked examples of each kind of hidden work**, and **a summary of what the cases show**. Those three, plus a quotable definition, are the changes to make. The about, privacy and press material matter to few readers and should stay small.

Method: nine composite personas ([personas](2026-10-19-site-content/personas.md)), 35 content blocks (14 built, 19 candidates, 2 calibration items) and 8 pages, judged by Jev 1.13 (`jev-1.13.0`). 27 requests, 711 questions, $0.006. Inputs, results and the analysis script are in [2026-10-19-site-content/](2026-10-19-site-content/).

## Can the answers be trusted

- Calibration held: a bread recipe and a staff login scored 0.02 and 0.04; the case table is the top block for the journalist (0.78) and the researcher (0.72).
- Second wording agreed 92 percent; repeats agreed 97 percent. Both are above the 80 percent bar, so single answers can be read, though decisions below rest on patterns across several personas.
- One known weakness showed: for the researcher, "would look for it" scored low across the board (dataset 0.40) while "how much does it matter" put the same block at 0.99 essential or useful. The literal "look for" question undercounts things a reader does not expect to find. Where the two disagree, this report follows the importance answer and says so.

## Findings

| Block | Readers using it (of 9) | Mean use | Essential or useful | Decision |
|---|---|---|---|---|
| Case table (built) | 9 | 0.81 | 1.00 | Keep; strengthen its type and add a summary above it |
| Three questions (built) | 9 | 0.80 | 1.00 | Keep on the home page |
| **Signs of the mistake** (new) | **9** | **0.79** | **1.00** | **Build**: a section on /idea and a short version on the home page |
| Before-you-cut guide (built) | 8 | 0.75 | 0.98 | Keep |
| **Examples per kind of hidden work** (new) | 8 | 0.74 | 0.99 | **Build**: one page per kind of work, with a hotel and an AI-era example |
| Reading list (new) | 9 | 0.74 | 0.97 | Build, on /idea |
| Short articles on patterns (new) | 8 | 0.74 | 0.99 | Defer: needs cases to draw patterns from |
| **Summary of all cases** (new) | 8 | 0.73 | 0.99 | **Build**: on /ledger and the home page, from the case files |
| Six kinds of hidden work (built) | 7 | 0.72 | 0.97 | Keep; each links to its own page |
| What is known so far (new) | 7 | 0.71 | 0.98 | Build, on /idea, from verified sources only |
| Cases per kind of missing work (new) | 7 | 0.70 | 0.98 | Build, as part of each kind's page |
| Common questions (new) | 7 | 0.69 | 0.90 | Build, on /approach |
| Filters on the ledger (new) | 7 | 0.68 | 0.96 | Defer until the ledger has about 50 cases ([architecture](../architecture.md)) |
| Starting points by role (new) | 6 | 0.67 | 0.95 | Build, as a short row on the home page |
| **Quotable definition** (new) | 6 | 0.66 | 0.94 | **Build**: on the home page and at the top of /idea, with how to cite |
| Dataset (new) | 4 | 0.56 | 0.83 (researcher 0.99) | Build: `/ledger.csv` and `/ledger.json`, linked from /ledger and /approach |
| When automation is the right call (new) | 0 | 0.44 | 0.71 | Build anyway, as a section on /idea (judgment below) |
| About (built) | 0 | 0.34 | 0.07 | Keep short |
| Press page (new) | 1 | 0.42 | 0.22 | Do not build; "how to cite" and the contact go on /approach |
| Workshop kit, fill-in-online guides, after-a-cut advice (new) | 0 to 1 | 0.20 to 0.37 | 0.10 to 0.45 | Do not build |

**Home page, what a first-time visitor should see first:** the opening question (0.40) and a definition (0.35) together take three quarters of the weight, ahead of the latest cases (0.10) and starting points (0.10). Decision: keep the hero, add the definition directly under it.

**Pages:** every persona visits the home page, /idea, /ledger and the case pages (0.63 to 0.90). /approach is visited by most (0.50 to 0.78). /about mostly by the journalist (0.65) and the researcher (0.57), and rarely by anyone else (0.16 to 0.38): it should answer a journalist's "who is behind this" quickly, and need not be long.

## Where judgment overrides Jev

- **When automation is the right call.** No persona crossed the use threshold. It stays: the site's stance is "use AI where it does the job", and a site that only shows failure reads as advocacy. Jev judges usefulness to the reader's task, not the site's credibility.
- **The dataset.** Built despite a low "use" score, for the reason above, and because it costs one build step.
- **Short articles.** High scores, but there is nothing honest to write until the ledger holds enough cases to show a pattern.

## Spend

$0.006 for the full run and $0.0002 for the small batch, summed from the recordings.

## Round 2: the readers round 1 left out

Round 1 had no one who had been laid off, no one in a redundancy consultation, and no one who stayed after a cut, so the content written for them was judged only by people it did not serve, and "after a cut" was wrongly marked "do not build". The persona set was checked against the role list too loosely. Round 2 added ten readers ([round2/personas.md](2026-10-19-site-content/round2/personas.md)): laid off, at risk, stayed, a customer who cannot reach a person, a chief executive, a small-practice owner, a lecturer, a ministry adviser, an equity analyst, and an AI agent designer. 30 requests, 990 questions, $0.009; second wording agreed 91 percent, repeats 98 percent.

Each new block, judged by the reader it was written for:

| Block | Reader | Use | Essential or useful | Decision |
|---|---|---|---|---|
| Questions for a redundancy consultation | at risk | 0.80 | 0.95 | Build |
| What to watch after an announcement | analyst (and 0.73 across all ten) | 0.80 | 1.00 | Build, on /idea after the signs |
| One-page brief for leaders | chief executive | 0.77 | 1.00 | Build |
| A small-business version of the questions | practice owner | 0.77 | 1.00 | Build, inside the leaders' page |
| Designing the hand-over to a person | AI agent designer | 0.74 | 1.00 | Build |
| Making extra work visible | stayed | 0.69 | 0.93 | Build |
| Next steps after a cut | laid off | 0.43 | 0.48 | Build anyway (judgment below) |
| A job-search link | laid off | 0.46 | 0.64 | Later, when a suitable service is live |
| Telling your own story privately | laid off | 0.46 | 0.66 | Not now: the suggest form takes links; first-hand accounts need consent and care |
| Advice for customers | customer | 0.41 | 0.70 | Out of scope: this reader would not come to the site (page visits 0.08 to 0.36) |
| Teaching notes | lecturer | 0.43 | 0.74 | Defer until the ledger has cases worth teaching |

Judgment over Jev: the laid-off reader ranked the cases, the signs and the examples highest and practical help low. Jev reads the site's description literally (an explainer and a ledger), so a reader "would not expect" help there. A person who has just lost a role needs words for the work they did, for interviews; what to ask the employer for in writing; and where to get advice. The site can give all three without giving legal advice.

**Decisions:** four pages by reader, linked from "Start here" on the home page:
- **If your job is changing** (at risk, cut, or stayed): consultation questions, next steps after a cut, making the extra work visible; with the hidden-job sheet.
- **For leaders**: a one-page brief, printable, and a short version for a small business.
- **For people who build AI service**: designing the hand-over so the hidden work reaches someone.
- **For journalists and researchers**: the existing reuse and citation section on /approach and the dataset.

Round 2 spend: $0.009 (full) and $0.0002 (small), from the recordings.

