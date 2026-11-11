# The doorman reading: evidence of loss, not of existence (2026-11-11)

**Conclusion.** 13 of the ledger's 14 cases named Judgment as hidden work that went missing, so the label said nothing. Most points rested on sentences such as "complex cases still go to people", which show the work exists, not that it was lost. A point now needs reported evidence that the work went missing, got worse, moved to others or landed on fewer people. Applied by hand to the 33 points, 6 stay and 27 go; 8 of the 14 cases have no reading yet. Jev can hold the rule for new drafts at a threshold of 0.3.

## Method

The 33 points in [points.json](2026-11-11-jev-reading/points.json), labelled by hand before any model ran: 6 yes (they report loss: overtime and team leaders on the phones at CBA, a recruitment drive to bring back people at Klarna, Mercado Libre's customers having to insist on a human and its remaining staff taking on the content work, Nielsen Italy's monitoring moved to staff without the cultural references), 4 borderline, 23 no. The pass mark, set first: at its best threshold Jev keeps all 6 yes and at most 1 of the 23 no. `node scripts/jev-reading-check.ts` asks `readingQuestion` from `desk/statement-check.ts`. Cost: $0.0007.

## Results ([results.json](2026-11-11-jev-reading/results.json))

| Threshold | Yes kept (of 6) | Borderline kept (of 4) | No kept (of 23) |
|---|---|---|---|
| 0.3 | 6 | 1 | 1 |
| 0.4 | 5 | 1 | 1 |
| 0.5 | 5 | 1 | 0 |
| 0.6 | 5 | 0 | 0 |
| 0.7 | 4 | 0 | 0 |

The pass mark is met at 0.3. The one "no" it keeps (Telenor: "other customer centres had been cut") reports more cuts, not lost work. At 0.5 Klarna's recruitment drive falls out. The desk uses 0.3, and each case is still read before publishing.

## Limits

One labeller, 33 points from the ledger's own cases, one run. Re-run the script after a Jev model change, and add points as the ledger grows.
