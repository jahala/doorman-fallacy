# Does the statement check work on Norwegian and Danish sources? (2026-10-21)

**Conclusion: yes. Keep the 0.6 threshold.** Jev separates faithful English statements from false ones as well when the cited sentence is Norwegian or Danish as when it is English. The Dinero draft's failures were statements that said more than their sentence: a company name the sentence does not contain ("his company", "our customer support"), and a date one day off. The drafting prompt now keeps each statement to the names, numbers and dates its own sentence gives.

## Method

46 pairs in [pairs.json](2026-10-21-jev-languages/pairs.json): 19 real source sentences from E24 and Telenor's release (Norwegian), DR (Danish), and the CBA, Klarna and Salesforce cases (English, the control). Each sentence has one faithful English statement and one false one: a wrong number, date, area, speaker or outcome, an added claim (such as an AI chatbot the source does not mention), or an overstatement. `node scripts/jev-language-check.ts` asks each pair the drafting step's own question (`desk/statement-check.ts`) with `jev-latest`. Cost: $0.0012.

## Results ([results.json](2026-10-21-jev-languages/results.json))

| Language | Faithful pairs passing at 0.6 | False pairs passing | Lowest faithful | Highest false |
|---|---|---|---|---|
| Norwegian | 13 of 13 | 0 of 13 | 0.69 | 0.13 |
| Danish | 5 of 6 | 0 of 6 | 0.50 | 0.08 |
| English | 4 of 4 | 0 of 4 | 0.60 | 0.04 |

The one Danish pair below 0.6 dropped a hedge: the sentence says the company "potentially" would have had to hire 30 people, the statement says it "would have had to". The check was right to doubt it.

## Limits

One run, 23 sentences, written by one person. The false statements are clear errors; subtler ones (a softened hedge, a shifted time frame) were not tested. Swedish is untested. Run the script again after a Jev model change.
