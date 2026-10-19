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
- Ledger table: company with country and area beneath; change; reported outcome; case link. Rows split by hairlines. Status is written as a word, never shown as a coloured pill. On screens narrower than 40rem each row stacks into a block and each cell shows its column name.
- Checklist page: questions with ruled writing space, designed for print first.
- Suggestion form: the same field style as sign-up. Link fields sized for a URL, the note field a few lines tall, name and email marked optional, the credit box below them.
- Sign-up form: a visible label above the field, which is sized for an email address (about 28 characters), and the black Subscribe button. The help line sits below.
- Footer: wordmark, curator line, About the curator, then Sources & approach, Suggest a case and Privacy. The Sutherland credit closes the page.

## States

- Focus: 2-pixel accent outline, offset 3 pixels, on every interactive element.
- The sign-up form posts to the Worker, which answers with a "check your email" page in the site's layout. The confirmation email and the confirmed and unsubscribed pages use the same words and wordmark.
- The suggestion form posts to the Worker, which answers with a thank-you page. A rejected entry (too long, missing links) comes back with the fields kept and the problem written next to the field.
- An empty ledger never ships; the site launches with ten cases.
- Not found: a 404 page in the site's layout that links to the idea and the ledger.

## Print

The two checklists print on one page each, on A4 and US Letter. Print hides the header, the nav and the sign-up, and shows the page address at the foot.

## Motion

None.

## Photography

Black-and-white documentary photographs of real people, with a caption and the photographer's name. Colour photos are converted to black and white. Visible company names and logos are cropped out. Sources and credits: [D-005](decisions.md); files in `src/assets/photos/`.
