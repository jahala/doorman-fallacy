# Engineering

## Stack

- Astro, static output, TypeScript in strict mode.
- A Cloudflare Worker for the form routes, with D1. Handlers read the request and D1, then hand values to `lib/`.
- The desk: TypeScript scripts run by Node on Jan's Mac, driving Claude Code agents.
- Content collections with a schema for the ledger.
- Cloudflare Workers with static assets, deployed with Wrangler.
- Vitest for `lib/` and the scripts. Playwright for checks against the built site.
- ESLint and Stylelint. Type checks cover `scripts/` and the config files too.

Versions are pinned in `package.json` and `.nvmrc` at scaffold time.

## How code is written here

- `lib/` holds every rule the site computes. Functions there are pure and total: they take data and dates as arguments and return a value, including the failure case.
- Pages and components arrange data. They do not decide anything a test would need to check.
- Text the reader sees lives in the page or the case file. Vocabularies live in `src/data/`.
- No client-side JavaScript. Forms are plain HTML forms. If an interaction ever needs script, that is a new decision in [decisions.md](decisions.md).
- Images go through Astro's image pipeline, so every image ships in modern formats with its width and height set.

## Tests

| Kind | What it covers | Runs |
|---|---|---|
| Unit | `lib/`, the scripts, the Worker's handlers, the desk's checks, token contrast | Every change |
| Build | Schema validation of every case; type checks | Every change |
| Lint | ESLint, Stylelint, the copy and docs checks | Every change |
| Site | Playwright against `dist/`: accessibility, print, links, no JavaScript | Every change; the site is small |
| Size | A build with 500 generated cases | When the ledger page, the schema or `lib/` changes |

Commands and measured times go in the brief once /test-setup has run.

Test rules:

- Today's date and any ids are passed in. No test reads the clock.
- The site tests serve `dist/` on a free port chosen at start, never a fixed one.
- Each run writes to its own temporary folder, records the processes it starts, and removes both on every ending, including when killed. A final check confirms it left nothing of its own behind.

## Publishing checks

No person reviews a case before it goes live ([D-009](decisions.md)). These checks take that place. A case is published only when all pass, and `scripts/check-cases` runs the mechanical ones in every build too.

1. **Format.** The schema passes, every cited id exists, every source is cited, and the body's headings are present and in order.
2. **Quotes are real.** Every quote is found word for word in its source's archived copy. This is a text match with no model involved, so an invented fact cannot pass.
3. **Claims stay inside their quotes.** A second agent, separate from the writer, reads each sentence next to its quote. It fails a sentence that says more than its quote, guesses at motives, or uses loaded words.
4. **Inclusion rule.** The same agent confirms the case meets the rule in [data-model.md](data-model.md#what-counts-as-a-case).
5. **Sources.** One primary source, or two independent reports, counted from each source's `kind`.

Checks 2 and 5 need no model. Checks 3 and 4 do, and their verdicts are stored with the run so a rejection can be read later.

## Rules and their guards

Every rule this project states is listed here once, with what fails when it breaks. A check that reads source text has a sample in `tests/fixtures/` that it must flag.

| Rule | Guard |
|---|---|
| Every case matches the format in [data-model.md](data-model.md) | Content schema; the build fails. A fixture case must fail it |
| Every update cites at least one source, each with an archive link | Content schema |
| Every cited source id exists, and every source is cited | Content schema. Not built yet: arrives with the new case format |
| Body headings present and in order; every factual sentence carries a footnote | `scripts/check-cases`. Not built yet |
| Every quote appears word for word in its archived source | Publishing check 2. Not built yet. A fixture with an altered quote must fail |
| Statuses and hidden functions come from their vocabularies | Content schema reads `src/data/` |
| Ledger text fits its columns (60 and 80 characters) | Content schema |
| The next review date follows the status table in [data-model.md](data-model.md#derived-never-stored) | Unit test of `lib/review.ts`. Not built yet: the derived date arrives with the new case format |
| The current status is the latest update's status | Unit test of `lib/status.ts` |
| `lib/` is pure: no clock, files or network | ESLint restricted globals and imports for `src/lib/`. A fixture file must be flagged |
| No client-side JavaScript ships | Site test: `dist/` contains no script files or inline scripts |
| Colours come only from tokens | Stylelint bans colour values outside `tokens.css`. A fixture must be flagged |
| Text tokens meet WCAG AA in light and dark mode | Unit test computes contrast from `tokens.css` |
| Pages pass an accessibility scan | Site test runs axe on every route |
| Each checklist prints on one page, A4 and US Letter | Site test prints to PDF and counts pages. Not built yet: arrives with the checklist pages |
| Internal links resolve | Site test crawls `dist/` |
| No em dashes in site copy | `scripts/check-copy` scans `src/content/`, `src/pages/`, `src/layouts/`, `src/components/` and `src/data/`. A fixture must be flagged |
| Docs name only paths that exist; the brief stays under 150 lines | `scripts/check-docs` |
| The ledger page builds and stays light at 500 cases | Size test; the page-weight budget is set from the first measurement. Not built yet: arrives with the ledger page |
| No promises left unawaited, scripts included | ESLint `no-floating-promises` |
| Cases due for review are reviewed | Unit test of `lib/review.ts`. The desk's review step is not built yet |
| Sources still resolve | Not built yet: the desk's report will list dead links. It does not block a build, since outside sites fail on their own |
| Write what was reported, never motives | Publishing check 3. Not built yet |
| Personal data is deleted on time | Unit tests of the retention rules in `lib/`, run by the Worker's daily job. Not built yet |
| No client-side JavaScript, forms included | Site test above; the forms are plain HTML posting to the Worker |
