# Site review (2026-11-11)

A walk through every page at desktop and phone width, with 14 cases in the ledger. Findings are ranked by how much they mislead or tire a reader. Item 1 was fixed in PR #26, items 2, 3, 4, 6 and 7 in PR #28, and item 5 with D-025.

## 1. A false statement (fixed)

How the ledger is kept said Claude writes the cases. The desk moved to DeepSeek Flash (D-021). The page now says AI agents research and write each case, which stays true whichever model runs.

## 2. Judgment is on 13 of 14 cases, so it says nothing

The doorman reading tags Judgment on every case but Klarna. Under Judgment on /idea, "In the ledger" lists 13 links, and the ledger summary reads "Judgment 13". Most of these rest on one kind of sentence: "complex cases still go to people". That sentence is true of almost any automation, so it does not show judgment going missing.

Proposal: a point of the reading needs reported evidence that this work went missing or moved, not that it exists. Tighten the drafting prompt to say so, then re-check the 14 cases and keep only points that meet it. Expect some cases to keep one point or none.

## 3. "Reported outcome" often is not an outcome

The ledger's outcome column shows the latest update's one-line summary. For TikTok it is "Automated systems removed 96.7 per cent of first-quarter takedowns"; for Nielsen Italy, "First meeting with the company set for 13 April in Milan". Neither says what happened to the people or the work.

Proposal: the column shows the status word and the date of the latest news, and the summary line is written as an outcome or left out. Settled in the drafting prompt and the update schema.

## 4. The home page shows the least eventful cases

The home preview lists the five newest announcements, and four of the five read "Too early to tell". The cases where something happened (CBA reversed, Klarna partly reversed, Mercado Libre ordered by a court to re-admit a worker, Konecta's parliamentary question) sit below the fold on /ledger.

Proposal (your call): order the home preview by latest news instead of announcement date, so movement shows first.

## 5. /idea asks three overlapping sets of questions

The page runs to about nine screens. It asks six "questions to ask" (one per kind of hidden work), three questions with five research-backed steps, and six signs of the mistake. A reader meets the same idea three times in three shapes.

Proposal (each removal is your call): keep the three questions as the one checklist. Fold the six signs into it as one line each under the question they belong to, and drop the per-kind "question to ask". Each hidden-work entry also repeats a hotel example the story already tells; the entry could keep the meaning, today's example and how its loss shows.

## 6. Case pages run long and repeat themselves

Cases written by DeepSeek Flash cite 18 to 29 sentences; the earlier ones 7 to 10. The timeline repeats the quotes the body has just shown (on CBA, both timeline entries reprint body footnotes in full).

Proposal: cap the body in the drafting prompt (about 12 cited sentences), and let the timeline show the date, the status and one line, linking to the footnote instead of reprinting the quote.

## 7. Smaller fixes

- A footnote whose source sentence opens with a quote mark shows two (CBA footnotes 1 and 8). The renderer should not add a second pair.
- Change lines vary: Konecta's is union jargon ("670 roles in excess: 600 operational and 70 staff"), and Nielsen Italy's has no full stop. One style, held by the case check.
- The home page says "companies", the ledger "organisations". One word.
- Telenor (2024) still reads "Too early to tell". The review step re-checks old cases, but the weekly schedule is not installed yet, so no case has been re-checked since it was written.

## Recommended order

2 and 3 first: they are what makes the ledger trustworthy and readable, and both are fixed at the desk with a re-check of the existing cases. Then 6 and 7, which are mechanical. 4 and 5 change what people see and need your yes per item.
