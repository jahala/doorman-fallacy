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

## D-003 · 2026-10-19 · Buttondown runs the newsletter (replaced by D-008)

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

## D-006 · 2026-10-19 · One family, warm greys, one headline weight (family changed by D-013)

Context: the mockups disagree on grey temperature and headline weight.

Chosen: warm greys everywhere and one display weight, confirmed on a type specimen page. Details in [design.md](design.md).

Why: one hierarchy reused across every view.

## D-008 · 2026-10-19 · Own the subscriber list; cfmail sends one-off mail

Context: D-003 chose Buttondown so the site would store no personal data and run no server code. The suggestion form (D-011) needs a Worker and D1 anyway, so that reason no longer holds.

Chosen: subscriber addresses live in D1. cfmail's service mailbox sends the confirmation email and the desk's weekly report. The monthly letter's sender is chosen later, when there are subscribers and something to send.

Why: no outside service until one is needed. The letter cannot go through cfmail: Cloudflare Email Sending allows only transactional mail (its FAQ, checked 2026-10-19), and cfmail's own decision D-3 notes that a review of the account would pause sending for every project on it.

## D-009 · 2026-10-19 · AI agents keep the ledger; checks replace a human reviewer

Context: Jan wants the ledger to run on AI end to end, with no one reviewing cases before they go live.

Chosen: agents find, write, check and publish cases. Strict checks stand in for the reviewer: every factual sentence carries a verbatim quote, a script confirms each quote against the archived source, and a second agent rejects sentences that go beyond their quotes or guess at motives. The approach page says the ledger is kept by AI and lists the checks. Jan gets a weekly report and can take any case down with one command.

Why: a site that names companies cannot publish invented facts. A plain text match against the archived source makes that impossible without a person in the loop. Saying openly that AI keeps the ledger, and how it is checked, fits the site's own argument.

## D-010 · 2026-10-19 · A case is a living record in plain Markdown

Context: a case changes over time, so it fits neither a blog post nor a static article. o-o's living documents were the model considered.

Chosen: one Markdown file per case. From o-o it takes a per-case watch contract, archived sources and a visible changelog. Sources are one list cited by id. The body has fixed headings, and reported facts are kept apart from the site's labelled analysis. MDX is not used.

Why: the page template renders the structured parts, so the prose needs no components. Plain Markdown is what agents write most reliably and what check scripts can parse. A single self-updating file per case, as in o-o, would lose the shared build and the ledger index.

## D-011 · 2026-10-19 · Readers suggest cases through a form

Context: the plan had a `mailto:` link for suggestions. Jan asked for a form.

Chosen: a plain HTML form at `/suggest` posting to the Worker: article links, an optional note, an optional name and email, and a box to be credited by name. Every case page links to it as "Report an error". Spam is held off by a honeypot field, a rate limit and length limits.

Why: a form gives the desk structured leads, and crediting people who suggest cases rewards them for helping. The email is used only to ask about that suggestion, and names and emails are deleted 90 days after a suggestion is resolved.

## D-012 · 2026-10-19 · The desk runs on Jan's Mac

Context: the desk's agents need a model. On Jan's subscription through Claude Code they cost nothing extra. On the Claude API in Cloudflare every call is metered.

Chosen: a weekly launchd job on Jan's Mac. A daily GitHub Action checks site health separately.

Why: no running cost. The cost is that a sleeping Mac delays the run. A missed week is caught up at the next wake, and the report says the run was late. Move to the API only if that delay becomes a problem; metered calls would then go through one budgeted door.

## D-013 · 2026-10-19 · Prata for headings, Inter for the rest

Context: D-006 set one family, Inter, with the headline weight to be chosen. Jan asked for a different heading face and tried Mona Sans, Radio Canada Big and Corben before Prata.

Chosen: Prata for the display and title styles and the wordmark. Inter stays for body text, leads, tables, forms and captions. That is two families, the most the site allows. Prata has one weight, 400, so the headline weight question from D-006 is settled by the face. Display tracking is -0.01em.

Why: Jan's choice. A high-contrast serif reads like the signage of the grand hotels where doormen work, and it separates headlines clearly from the Inter text below them.

## D-014 · 2026-10-19 · MIT for code, CC BY 4.0 for the ledger and site text

Context: the repository goes public before launch, and Jan asked for the licence to be chosen for him.

Chosen: the code under MIT (`LICENSE`), as Jan's other published projects. The cases and the site's text under Creative Commons Attribution 4.0 (`LICENSE-CONTENT`). The photographs stay under the Unsplash licence and are credited.

Why: MIT lets anyone reuse the desk and the site. CC BY lets journalists, researchers and teachers reuse a case as long as they credit it, which spreads the ledger and keeps its name attached. A licence that forbids commercial reuse would keep cases out of most newspapers.

## D-015 · 2026-10-19 · The Worker redirects the other hostnames

Context: both domains are active Cloudflare zones (2026-10-19). Wrangler's login cannot create redirect rules or DNS records, and a dashboard rule would be configuration that lives outside the repository.

Chosen: at the first deploy, the Worker takes thedoormanfallacy.com, www.thedoormanfallacy.com, doormanfallacy.com and www.doormanfallacy.com as custom domains, and answers any host but the first with a 301 to https://thedoormanfallacy.com, keeping the path and query.

Why: the redirect is then code: tested, versioned and deployed with the site. Custom domains create their own DNS records, so nothing is set by hand.

