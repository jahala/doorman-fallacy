# Design

## Reference

The five mockups in [design-reference/](design-reference/) are the visual reference for layout, hierarchy and tone. They are generated images, so they settle the look and leave exact values to the tokens below. Where they disagree with each other, this doc says which way the site goes.

What they establish:
- Warm paper background, near-black type, hairline rules between sections.
- A grotesque sans-serif. Very large, tightly set headlines; a grey secondary line under each.
- A wide two-column grid: headline left, supporting text or form right.
- Black-and-white documentary photography with a small caption.
- One red accent, used only to mark where you are.
- Underlined text links. One solid black button, for Subscribe.

## Where the mockups disagree, and what the site does

| Mockup difference | Site does |
|---|---|
| Hero greys are warm; ledger, checks and sign-up greys are cool blue-grey | Warm greys everywhere |
| Hero headline is medium weight; the other headlines are bold | One weight for every headline: Prata's only weight, 400 ([D-013](decisions.md)) |
| Paper is #FAF9F7 on the hero and near-white elsewhere | #FAF9F7 everywhere |
| ↗ appears on internal links ("Read case", "View all cases") | ↗ marks only links that leave the site. Internal links have no arrow |
| "Who takes it on" copy uses an em dash | Rewritten without it |
| Ledger shows "Illustrative entries based on the proposed cases" | Removed; real cases only |

## Tokens

Proposed from the mockups, pending Jan's approval on the specimen page. They live in `src/styles/tokens.css`, the only file allowed to hold colour values. Contrast is stated against `paper`; the text colours are also tested against `surface` ([engineering.md](engineering.md#rules-and-their-guards)).

Colour:

| Token | Light | Dark | Use | Contrast (light / dark) |
|---|---|---|---|---|
| `paper` | #FAF9F7 | #121211 | Background | |
| `surface` | #FFF | #1C1C1A | Bands that set an illustration apart | |
| `ink` | #0B0B0A | #F3F2EE | Headlines, body, the button | 18.7 / 16.7 |
| `ink-2` | #55544F | #B4B2AC | Secondary lines, table meta | 7.2 / 8.8 |
| `ink-3` | #6A6964 | #9C9A94 | Captions, fine print | 5.2 / 6.7 |
| `rule` | #D6D5D1 | #34332F | Hairlines (decorative) | 1.4 / 1.5 |
| `field` | #8C8B86 | #77756F | Input borders | 3.2 / 4.1 |
| `accent` | #A92819 | #F0654F | Current page marker, focus ring | 6.6 / 6.0 |

The accent was sampled from the hero mockup's nav underline. Error, warning and success colours are added only when a function needs one.

Type: two families, self-hosted ([D-013](decisions.md)). Prata, a high-contrast display serif with one weight, sets headings (`hero`, `display`, `title`, `subhead`) and the wordmark. Inter, with its optical-size axis, sets everything else. Both are under the SIL Open Font License.

| Token | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `hero` | clamp(3rem, 7vw, 5.5rem) | 400 | 0.95 | -0.01em | The home page's title, and nothing else |
| `display` | clamp(2.4rem, 5.6vw, 4.4rem) | 400 | 0.95 | -0.01em | Page titles; section headings on the home page. Four fifths of `hero` |
| `title` | clamp(1.75rem, 3vw, 2.5rem) | 400 | 1.1 | -0.02em | Section headings on text pages; the home page's h3 and its sign-up heading |
| `subhead` | clamp(1.25rem, 2vw, 1.75rem) | 400 | 1.2 | -0.01em | Third-level headings, and the names of things in a list |
| `lead` | clamp(1.25rem, 2vw, 1.75rem) | 400 | 1.35 | -0.01em | First line under a headline |
| `body` | 1.125rem | 400 | 1.55 | 0 | Running text |
| `small` | 0.9375rem | 400 | 1.45 | 0 | Table meta, form help |
| `caption` | 0.875rem | 400 | 1.4 | 0 | Photo captions, footnotes |

Hierarchy: every page uses the same four levels, and a site test holds them (`tests/e2e/navigation.spec.ts`).

| Level | Home page | Every other page |
|---|---|---|
| h1 | `hero` | `display` |
| h2 | `display` | `title` |
| h3 | `title` | `subhead` |
| A name inside an h3's content | `label`: body at weight 500 | `label` |

Names of things in a list, in an illustration or in a table (a kind of hidden work, a company, a status row's holder) use `subhead`. Values in data (a fact, a status, a publisher) use `label`. The sign-up at the foot of the home page is a form, so its heading uses `title`. Section and list numbers are Inter at the `small` size in `ink-2` (`section-number`), because Prata's 1 reads as a lowercase l. A case's Markdown is written with `##` headings; the Markdown processor renders them one level lower, as h3, so they sit under the section's h2 (`src/lib/demote-headings.ts`).

Space: a 4-pixel base, with steps at 4, 8, 12, 16, 24, 32, 48, 64, 96 and 128. Sections are separated by a hairline and 96 to 128 pixels above and below.

Layout: a 12-column grid with content up to 1400 pixels wide and side margins of clamp(1.25rem, 4.5vw, 4.5rem). Text columns stop at about 65 characters.

## Components

- Site header: wordmark left; The idea, The ledger, About and Subscribe right. The current section has a 2-pixel accent underline: The idea on `/idea` and its six pages; The ledger on `/ledger`, case pages, `/approach` and `/suggest`.
- Navigation: the site has two sections, the idea and the ledger. Their pages read in order, `/idea` then `/ledger` then `/approach`, and each ends with a pager to the next.
- Breadcrumbs: on pages below a section page (`/approach`, `/suggest`, case pages, the six hidden work pages), above the title, at the `small` size in `ink-2`, each level a link and the page itself last, separated by slashes. Top-level pages have none.
- Contents ("On this page"): on `/idea`, `/ledger` and `/approach`. On wide screens it sits in the right four columns of the page head, beside the title and lead, which take the left eight; on phones it follows them. Numbered, hairline-ruled rows, one column, linking each section. The same number sits above each section's heading.
- Pager: at the foot of a page, under a hairline. A `small` `ink-2` word (Previous, Next or Back to) above the page name in `subhead`; previous on the left, next on the right.
- Text link: 1-pixel underline in `ink`, offset below the baseline. ↗ only for external links.
- Section: hairline, then the number and heading in the left four columns and the text in the right eight, about 65 characters wide. A section can hold a block under its heading (the portrait on `/idea#hidden`) and a wide block under its text that spans the grid.
- Ledger table: company with country and area beneath; change; reported outcome; case link. Company names are set in `subhead`. The outcome cell opens with the current status as a word at the `small` size in `ink-2`, normal weight, then the latest update's summary. Rows split by hairlines. Status is never a coloured pill. On screens narrower than 40rem each row stacks into a block and each cell shows its column name. The home page shows the five newest cases in a compact form: the column heads are visually hidden, and the status sits under the change as "Reported outcome: Holding." in place of the outcome. Its caption gives the count and says what every case holds; `/ledger` shows all under The cases, with a count and a link to the approach under the table.
- Ledger summary: one sentence at the `lead` size, "5 cases: 2 holding, 1 strained." (only statuses that have cases), then a `small` row, "Hidden work recorded as missing:", with each hidden function as a link to its page and its count in `ink-2`. It sits above the table on `/ledger`, and is left out when there are no cases.
- Home page: the hero; "The work beyond the task", with the heading and a lead in the left six columns and the six kinds of hidden work in two columns on the right, each name a link in `subhead` with its meaning in `ink-2`, then a link to the three questions; the ledger preview; the sign-up.
- The three questions (`/idea#questions`): each question is a row under a hairline, with "Question 1" and its name in the heading column and its ideas, each with its sources, in the text column. On phones they stack. The signs of the mistake close the section as a fourth row.
- Numbered list (the signs on `/idea#signs` and `/ledger#watch`): one column of items, each with its number, the sign in `label` and its detail in `ink-2`.
- Hidden work on `/idea`: the cards sit in two columns on the right, and the portrait sits under the section heading on the left. Each card links to `/idea/<id>` with "At the hotel, today, and in the ledger". Visually hidden text after the link names the function, so the six links differ.
- Hidden function page: breadcrumbs, the icon, the label in display type, the meaning as the lead. Its sections sit on the same grid as the text pages. The question to ask is set in `subhead` as a pull question. The cases in the ledger are listed as the short name (a link, in `subhead`), the change in `ink-2` and the evidence sentence. The pager leads to the kinds either side; past the first it leads back to `/idea#hidden`, past the last on to `/idea#questions`.
- Empty ledger: a headline, one lead sentence and a link to the idea, between two hairlines, in place of the table.
- Case page: breadcrumbs, a kicker (country, area, announcement date), the company's short name in display type, the change as the lead, then a hairline-ruled facts row (status, roles, the door, last checked, next review). Each section below sits on the grid with its label on the left and a reading column of about 65 characters on the right: Reported (the Markdown body, then its footnotes as small ink-2 quotes), The doorman reading (labelled as analysis), What they said (pull quotes), Timeline, Changelog, Sources and Report an error. A statement outside the body cites its source with a small superscript link, S1, S2 and so on, to the numbered Sources list. The report form uses the same field style as the other forms, with a note field a few lines tall, and is hidden in print. A pager leads back to the ledger.
- Suggestion form: the same field style as sign-up. Link fields sized for a URL (the first shown, four more behind "Add more links", which needs no script), the note field a few lines tall, name and email marked optional, the credit box below them. A report of an error in one case is a short form on the case page itself, with a required note and an optional email.
- Sign-up form: a visible label above the field, which is sized for an email address (about 28 characters), and the black Subscribe button. The help line sits below.
- Footer: the wordmark in the left four columns; a site map in the right eight, in three groups (The idea, The ledger, The site), each a `small` `ink-2` label over its links, which are underlined only on hover, like the header's. The Sutherland credit closes the page.

## Illustrations

Two diagrams and six icons explain the idea without photographs. Each diagram sits in a respite: a band of `surface` that runs to both edges of the window, 96 pixels above and below, with the diagram's name as an h3 in the heading column and what it shows in the text column. A band that ends its section is the section's end, with no hairline after it. The diagrams are HTML and CSS with real text, so they reflow on phones, read aloud and follow the type scale. SVG is used only for the icons and for decorative arrows, always with `currentColor`, so every illustration takes the tokens in both schemes; a site test fails on any SVG that writes its own colour.

- **Where the hidden work goes** (`/idea#questions`, under the third question): before the change one person holds the visible task and all six; after it the system takes the task and the six go to another team, the customer or nobody, the last in a dashed frame. Its text says it is one possible outcome.
- **Saved now, lost later** (`/ledger#watch`): a two-row timeline. The saving is a solid `ink` chip at once; the costs are dashed `ink-3` chips months later. On phones each time step stacks under its row.
- **Six icons**, one per kind of hidden work, on a 24-pixel grid with 1.5-pixel strokes, in `ink-2`: a figure with presence radiating (signal), an eye (deterrence), a path that forks at a decision (judgment), a notebook with a ribbon (memory), a wave dying down (absorption), and a container with headroom (slack). They sit beside the labels and never carry meaning alone.

## Share cards

Every page names a 1200 by 630 card for Open Graph and Twitter: the site's own, one per hidden function and one per case. A card has the paper colour, the wordmark in Prata at the top with a hairline under it, a small `ink-2` kicker, the title in Prata, one line in Inter and `ink-2`, and the site address at the foot. A case card shows the current status as a word at the foot, never as a pill. There is no photograph and no accent. Colours come from the tokens through `lib/tokens.ts`; the title steps down from 96 to 64 pixels as it gets longer. Only the Prata and Inter files that satori can read are used ([D-017](decisions.md)). The pages also set the favicon (`/favicon.svg`), the touch icon and a `theme-color` for each scheme, read from the `paper` token.

## States

- Focus: 2-pixel accent outline, offset 3 pixels, on every interactive element.
- The sign-up form posts to the Worker, which answers with a "check your email" page in the site's layout. The confirmation email and the confirmed and unsubscribed pages use the same words and wordmark.
- The suggestion form posts to the Worker, which answers with a thank-you page. The browser's own checks catch a missing or malformed link, a field over its limit and a bad email before anything is sent. What still fails on the server goes to a problem page that says what to check and links back to the form; the fields are not kept, because keeping them needs a page built per request.
- Every page that answers a form uses the Notice layout: a display heading, one line, and one link on. These pages ask search engines to skip them.
- An empty ledger never ships; the site launches with ten cases. The empty state above exists so a build with no cases still reads well, and a test builds one.
- Not found: a 404 page in the site's layout that links to the idea and the ledger.

## Print

Print hides the header, the nav and the sign-up, uses light colours, and shows the page address at the foot. No page is designed for print first.

## Motion

None.

## Photography

Black-and-white documentary photographs of real people, with a caption and the photographer's name. Colour photos are converted to black and white. Visible company names and logos are cropped out. Sources and credits: [D-005](decisions.md); files in `src/assets/photos/`.
