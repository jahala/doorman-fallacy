# Decisions

Newest last. Each entry: context, what was chosen, why.

## D-001 · 2026-10-19 · A static site built with Astro, served by Cloudflare

Context: the site is pages, a ledger of case files, two printable checklists and a sign-up form. Nothing needs a server.

Chosen: Astro with static output and content collections, served as static assets by a Cloudflare Worker.

Why: content collections validate every case against a schema at build time, so a malformed case cannot ship. Static output has no server to fail or secure. Cloudflare is where Jan's other sites run and where the domains are moving.

## D-002 · 2026-10-19 · The ledger is Markdown files in git; status is derived

Context: cases change over time, and the change history is part of the site's credibility.

Chosen: one Markdown file per case, with an append-only list of dated updates. The current status is the latest update's status and is never stored on its own.

Why: git keeps every change with its reason. Deriving the status means it can never disagree with the updates.

## D-003 · 2026-10-19 · Buttondown runs the newsletter

Context: the letter needs sign-up, confirmation, sending and unsubscribe. Cloudflare's own email sending is in public beta and built for transactional mail, without list management.

Chosen: Buttondown. The site's form posts directly to it.

Why: the site then stores no personal data and needs no server code. Buttondown handles consent and unsubscribe. It is free to 100 subscribers, which is enough to learn whether people want the letter.

## D-004 · 2026-10-19 · Private first, public before launch

Context: the ledger names companies. Readers need to trust that facts are corrected in the open.

Chosen: a private GitHub repository now, made public before the site launches, with each case page linking to its history. The history is kept clean from the first commit, so it can be published as it stands.

Why: a visible correction history is the strongest answer to "who says?". Public repositories also get free CI minutes. The licence is chosen before it goes public.

## D-005 · 2026-10-19 · Real photographs from Unsplash, credited

Context: the mockup's hero photo is generated. A generated doorman on a site about what automation misses hands critics an easy line.

Chosen: two photographs under the Unsplash licence. The hero is "The Silent Sentinel" by atelierbyvineeth (Dublin), cropped to leave out the hotel's name. The portrait by Maryam Tello illustrates the idea page. Both photographers are credited by name next to their photos, although the licence does not require it.

Why: real photographs of real doormen. Crediting the people whose work the site uses is the site's argument in practice. The hotel's name is cropped out so no company is implied in a site that names companies.

## D-006 · 2026-10-19 · One family, warm greys, one headline weight

Context: the mockups disagree on grey temperature and headline weight.

Chosen: warm greys everywhere and one display weight, confirmed on a type specimen page. Details in [design.md](design.md).

Why: one hierarchy reused across every view.
