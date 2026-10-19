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

Proposed from the mockups, pending Jan's approval on the specimen page. They live in `src/styles/tokens.css`, the only file allowed to hold colour values. Contrast is measured against `paper` and tested ([engineering.md](engineering.md#rules-and-their-guards)).

Colour:

| Token | Light | Dark | Use | Contrast (light / dark) |
|---|---|---|---|---|
| `paper` | #FAF9F7 | #121211 | Background | |
| `ink` | #0B0B0A | #F3F2EE | Headlines, body, the button | 18.7 / 16.7 |
| `ink-2` | #55544F | #B4B2AC | Secondary lines, table meta | 7.2 / 8.8 |
| `ink-3` | #6A6964 | #9C9A94 | Captions, fine print | 5.2 / 6.7 |
| `rule` | #D6D5D1 | #34332F | Hairlines (decorative) | 1.4 / 1.5 |
| `field` | #8C8B86 | #77756F | Input borders | 3.2 / 4.1 |
| `accent` | #A92819 | #F0654F | Current page marker, focus ring | 6.6 / 6.0 |

The accent was sampled from the hero mockup's nav underline. Error, warning and success colours are added only when a function needs one.

Type: two families, self-hosted ([D-013](decisions.md)). Prata, a high-contrast display serif with one weight, sets headings (`display`, `title`) and the wordmark. Inter, with its optical-size axis, sets everything else. Both are under the SIL Open Font License.

| Token | Size | Weight | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `display` | clamp(3rem, 7vw, 5.5rem) | 400 | 0.95 | -0.01em | Section headlines |
| `title` | clamp(1.75rem, 3vw, 2.5rem) | 400 | 1.1 | -0.02em | Column heads, company names |
| `lead` | clamp(1.25rem, 2vw, 1.75rem) | 400 | 1.35 | -0.01em | First line under a headline |
| `body` | 1.125rem | 400 | 1.55 | 0 | Running text |
| `small` | 0.9375rem | 400 | 1.45 | 0 | Table meta, form help |
| `caption` | 0.875rem | 400 | 1.4 | 0 | Photo captions, footnotes |

Space: a 4-pixel base, with steps at 4, 8, 12, 16, 24, 32, 48, 64, 96 and 128. Sections are separated by a hairline and 96 to 128 pixels above and below.

Layout: a 12-column grid with content up to 1400 pixels wide and side margins of clamp(1.25rem, 4.5vw, 4.5rem). Text columns stop at about 65 characters.

## Components

- Site header: wordmark left; The idea, The ledger, About and Subscribe right. The current page has a 2-pixel accent underline.
- Text link: 1-pixel underline in `ink`, offset below the baseline. ↗ only for external links.
- Section: hairline, headline, lead, then content in the grid.
- Ledger table: company with country and area beneath; change; reported outcome; case link. Company names are set in Prata at the `title` size. The outcome cell opens with the current status as a word at the `small` size in `ink-2`, normal weight, then the latest update's summary. Rows split by hairlines. Status is never a coloured pill. On screens narrower than 40rem each row stacks into a block and each cell shows its column name. The home page shows the five newest cases and counts the rest in its caption; `/ledger` shows all, with a count and a link to the approach under the table.
- Ledger summary: one sentence at the `lead` size, "5 cases: 2 holding, 1 strained." (only statuses that have cases), then a `small` row, "Hidden work recorded as missing:", with each hidden function as a link to its page and its count in `ink-2`. It sits above the table on the home page and on `/ledger`, and is left out when there are no cases. The download line sits under the `/ledger` table at the `small` size.
- Definition band: on the home page, directly after the hero. A full-width section between two hairlines with a smaller 48-pixel space. The label "The doorman fallacy" in `caption` and `ink-2` sits in the left four columns; the definition sits in the right eight, in the `title` style and not italic, with a small "How to cite" link under it. On phones they stack.
- Signs of the mistake (`/idea#signs`): six numbered items in two columns on wide screens and one on phones, each under a hairline. The number is Prata in `ink-2`; the sign is medium-weight body text and its detail is `ink-2`.
- Hidden work on `/idea`: the cards sit in two columns on the right, and the portrait sits under the section heading on the left. Each card links to `/idea/<id>` with "At the hotel, today, and in the ledger". Visually hidden text after the link names the function, so the six links differ.
- Hidden function page: a kicker linking to `/idea`, the label in display type, the meaning as the lead. Its sections sit on the same grid as the text pages. The question to ask is set at the `title` size as a pull question. The cases in the ledger are listed as the short name (a link), the change in `ink-2` and the evidence sentence. Previous and next links close the page and do not loop.
- Empty ledger: a headline, one lead sentence and a link to the idea, between two hairlines, in place of the table.
- Case page: a kicker (country, area, announcement date), the company's short name in display type, the change as the lead, then a hairline-ruled facts row (status, roles, the door, last checked, next review). Each section below sits on the grid with its label on the left and a reading column of about 65 characters on the right: Reported (the Markdown body, then its footnotes as small ink-2 quotes), The doorman reading (labelled as analysis), What they said (pull quotes), Timeline, Changelog, Sources and Report an error. A statement outside the body cites its source with a small superscript link, S1, S2 and so on, to the numbered Sources list. The report form uses the same field style as the other forms, with a note field a few lines tall, and is hidden in print.
- Suggestion form: the same field style as sign-up. Link fields sized for a URL (the first shown, four more behind "Add more links", which needs no script), the note field a few lines tall, name and email marked optional, the credit box below them. A report of an error in one case is a short form on the case page itself, with a required note and an optional email.
- Sign-up form: a visible label above the field, which is sized for an email address (about 28 characters), and the black Subscribe button. The help line sits below.
- Footer: wordmark, curator line, About the curator, then Sources & approach, Suggest a case and Privacy. The Sutherland credit closes the page.

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
