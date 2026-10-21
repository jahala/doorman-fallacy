# DeepSeek Flash as the desk's agent model (2026-10-21)

**Conclusion: switch.** On six organisations with known answers, DeepSeek V4.1 Flash (`deepseek-flash`) gave Claude Sonnet's verdict on four and was more willing to draft on two, with reasons that hold up because it found more sources. Its two drafts passed every check, with more sources and statements than Claude's. It costs about an eighth as much and takes about three times as long. Claude Sonnet stays available with `--model sonnet`.

## Assessments

The same leads, assessed by each model (copies of the runs' `leads.json`, so Claude's assessments were kept).

| Organisation | Claude Sonnet | DeepSeek Flash | Flash cost, time |
|---|---|---|---|
| CBA | 3, draft | 3, draft | $0.03, 184 s |
| Salesforce | 3, draft | 3, draft | $0.03, 159 s |
| Dinero | 2, draft | 2, draft | $0.03, 223 s |
| Lufthansa | 1, reject | 1, reject | $0.03, 252 s |
| Atlassian | 1, reject | 3, draft | $0.07, 307 s |
| Allianz Partners | 2, watch | 3, draft | $0.03, 149 s |

Claude's assessments cost $0.15 to $0.25 each and took 33 to 84 s. On Atlassian, Flash found Atlassian's own filing (AI resolving more than 70 per cent of support conversations) and proposed recording Atlassian's denial beside the union's statement, as the Salesforce case does. On Allianz it found the chief executive confirming in July 2026 that AI was the reason for 1,500 to 1,800 cuts, which Claude had not found. Flash lists more kinds of hidden work, more of them inferred, and a smaller share of its assessment quotes were found word for word (for example 5 of 7, against Claude's 3 of 3). Those quotes are only used to judge the lead; drafting checks every quote again.

## Drafts (not published)

| Case | Claude Sonnet | DeepSeek Flash |
|---|---|---|
| CBA | 16 statements, 2 sources, passed after one revision, $0.31 | 31 statements, 7 sources, passed, $0.07 |
| Allianz Partners | not drafted (watch) | 38 statements, 5 sources in three languages, passed, $0.07 |

The Flash drafts are neutral and keep each side of a dispute. They are long: "What happened next" in the Allianz draft is one paragraph of ten statements.

## How it runs

Claude Code runs as before, pointed at DeepSeek's Anthropic-compatible API (`agentEnv` in `desk/claude.ts`). Claude Code prices models it does not know at a fallback rate and stopped a one-word run at its spending cap, so a DeepSeek run is bounded by 40 turns and the time limit instead, and its cost is worked out from the token counts at DeepSeek's peak rates. Its web searches go through DeepSeek's server-side Search and Fetch, free until 1 November 2026 and $0.00075 a request after.

## Limits

Six assessments and two drafts. The drafts were read for one case only. Watch the next weekly runs for drafts that pass the checks but read as overlong, and for watch cases that Flash drafts too early.
