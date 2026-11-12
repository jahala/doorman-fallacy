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

## D-016 · 2026-10-19 · The rate limit lives in D1

Context: the suggest and subscribe forms each allow 5 attempts per visitor per hour (D-011). Cloudflare's Rate Limiting binding was the first candidate. Its documentation (checked 2026-10-19) says a period can only be 10 or 60 seconds, that counters are kept per Cloudflare location, and that it is "permissive, eventually consistent, and intentionally designed to not be used as an accurate accounting system". It also advises against keying on IP addresses.

Chosen: a D1 table, `rate_hits`. One SQL statement counts the visitor's attempts in the last hour and inserts a new row only if there are fewer than 5, so two requests arriving together cannot both take the last place. The key is the SHA-256 of the form kind and the visitor's address. The daily job deletes rows older than an hour.

Why: a limit per hour cannot be written with the binding. A D1 count is exact across every location, and the load is a few writes a day. The cost is that visitors behind one shared address, such as an office or a mobile network, share five places an hour, which is more than a reader needs. A hash of an IPv4 address can be guessed back, so the table is treated as personal data and kept for under a day ([data-model.md](data-model.md#d1)). If real abuse arrives, Turnstile or a Cloudflare WAF rule goes in front of these routes; the D1 limit then stays as the second line.

## D-017 · 2026-10-19 · Share cards and the dataset are built with the site

Context: the site-content research ([2026-10-19-jev-site-content.md](research/2026-10-19-jev-site-content.md)) found that readers want a quotable definition, a page per kind of hidden work, a summary of the cases, and the data. Links shared to the site also showed no image.

Chosen: the share cards are drawn at build time with satori (layout to SVG) and @resvg/resvg-js (SVG to PNG), and the dataset is written by two build-time endpoints, `/ledger.csv` and `/ledger.json`. satori reads WOFF, TTF and OTF but not WOFF2, so the cards use the `.woff` files of `@fontsource/prata` and of the static `@fontsource/inter`; the pages keep using the WOFF2 files of the variable Inter. Both libraries and the extra font package are pinned to exact versions.

Why: no browser, no server and no second build step, and the cards and the data come from the same case files as the pages, so they cannot disagree with them. The cost is two dependencies, one of them native, and a build that grows with the cases: 500 cases build in about 8 s instead of 3 s, because each case gets a card. The cards carry no photograph, to keep that cost low.

## D-018 · 2026-10-19 · Cut what does not serve the idea or the ledger

Context: a reader-research round (docs/research/2026-10-19-jev-site-content.md) rated nearly every content block as useful to nearly every reader, and the site grew pages for leaders, employees and builders of AI service, a "Start here" grid, and two printable guides. Jan judged these as theater: they turn the site into an advice platform.

Chosen: the site does two things, explains the doorman fallacy and records what happened after organisations made that decision. The two printable guides ("Before the decision"), the reader pages and the "Start here" grid are removed. Kept, because they deepen the idea or make the ledger trustworthy: the definition, the six signs, what to watch after an announcement, a page per kind of hidden work, the ledger summary and data, what is known so far, when automation is right, the reading list, and the approach with its common questions.

Why: everything on the site should serve one of its two jobs. Jev judges whether a reader would use a block, not whether the site should offer it, so it cannot set the site's scope.

## D-019 · 2026-10-19 · Two sections, read in order, with one type hierarchy

Context: after D-018 the site still read as a patchwork. `/idea` held eleven sections, five overlapping lists (three questions, five steps, six signs, six signs to watch after an announcement, six kinds of hidden work), and things that belong to the ledger. Headings below h2 used four different styles. Nothing told a reader where they were or where to go next.

Chosen: the site has two sections, the idea and the ledger, and their pages read in order: `/idea`, then `/ledger`, then `/approach`. The three questions are the one way of seeing the whole job; the five steps became the ideas under them, and the signs of the mistake close them. What to watch after an announcement, the statuses and what is known beyond the ledger moved to `/ledger`; reuse moved to `/ledger#data`. Long pages open with a numbered contents list and end with a pager; pages below a section page show breadcrumbs; the header marks the section; the footer is a site map. One hierarchy holds on every page ([design.md](design.md)): h1 `display`, h2 `title`, h3 a new `subhead` token, and names inside an h3's content at body weight 500. The home page sets its h2 and h3 one step larger. A case's Markdown headings render one level lower, so they sit under their section's h2.

Why: a reader should always know where they are, what the page covers and where to go next. The questions and the ledger each answer one job, so content that serves the ledger now sits there. A site test checks the hierarchy, the contents, the breadcrumbs and the footer on every page, so the structure cannot drift back.

## D-020 · 2026-10-19 · The site is about the idea, not its owner

Context: the About page, the footer and How the ledger is kept named Jan and gave his career. Jan did not want that: the site is about the doorman fallacy and the ledger. He also gave a mockup for a calmer landing page.

Chosen: Jan's name is removed from every page but one. About describes the site. The privacy page keeps one line naming the person responsible for the data, because EU data protection law (GDPR article 13) requires a privacy notice to identify the controller; a registered business could be named there instead. The MIT licence keeps its copyright line, which the licence needs. The landing page follows the mockup: the hero, the six kinds of hidden work, a compact ledger preview and a smaller sign-up. The definition band, the three question columns and the whole-job diagram leave it. The definition stays at the head of `/idea`, the questions stay on `/idea`, and the diagram is removed, since the six kinds are now listed on the home page and on `/idea`.

Why: a site that argues for seeing the whole job should not lead with its owner. A shorter landing page reaches the ledger sooner.

## D-021 · 2026-10-21 · The desk's agents run on DeepSeek Flash

Context: the desk's assessment and drafting agents ran on Claude Sonnet through Jan's Claude subscription (D-012). That subscription is nearly used up, and Jan asked for DeepSeek Flash instead.

Chosen: `deepseek-flash` is the default model for `desk/assess.ts` and `desk/draft.ts`, run by Claude Code against DeepSeek's Anthropic-compatible API with the key `DEEPSEEK_API_KEY`. Claude Sonnet stays available with `--model sonnet`. The checks are unchanged: Jev still checks every statement and code still checks every quote.

Why: on six organisations with known answers, Flash agreed with Sonnet on four and found more sources on the other two, and its drafts passed every check, at about an eighth of the cost ([2026-10-21-deepseek-flash-desk.md](research/2026-10-21-deepseek-flash-desk.md)). The checks, not the writer, are what make a case trustworthy, so a cheaper writer with the same checks keeps the ledger as safe.

## D-022 · 2026-10-21 · Mental Audio AS is named as responsible for the data

Context: D-020 kept one line on the privacy page naming Jan, because a privacy notice must identify who is responsible for the data (GDPR article 13). Jan asked to name his company instead, as surraura.com does.

Chosen: the privacy page says the site is run by Mental Audio AS in Oslo, Norway, which is responsible for the data it describes. No person is named on the site. The MIT licence keeps its copyright line.

Why: the company meets the requirement and keeps the owner's name off the site, as D-020 intended.

## D-023 · 2026-10-21 · The six kinds of hidden work live on /idea, not on pages of their own

Context: each kind of hidden work had its own page (`/idea/<id>`) with five short sections, a share card and previous and next links. Jan judged six thin pages to be more than the idea needs.

Chosen: the pages and their cards are removed. Each kind is an anchored entry in "The hidden work" on `/idea`, with its meaning, its two examples, how its loss shows, the question to ask, and the cases in the ledger that record it missing. The home page, the ledger summary and the doorman reading on case pages link to `/idea#<id>`. The site had not been deployed, so no address needs a redirect.

Why: the content of all six fits on one screen, and a reader no longer leaves the idea six times to read it. The link from each kind to its cases, the one thing the pages did that /idea did not, is kept.

## D-024 · 2026-11-11 · One script: a cookieless page-view counter

Context: the site shipped no client-side JavaScript, and the plan named Cloudflare Web Analytics, which was never set up. Jan asked for the site to be counted in his own analytics on Cloudflare. That service tells visitors apart by hashing the address each request comes from, so page views sent by the site's Worker would all carry Cloudflare's address and count as a handful of visitors. The count has to come from the visitor's browser.

Chosen: one inline script on every page sends one page view per load to `e.thedoormanfallacy.com`. It sets no cookies and stores nothing, sends nothing from any host but thedoormanfallacy.com (so local runs and tests count nothing), and sends nothing under Do Not Track or Global Privacy Control. The visitor id is a hash of the address and browser with a key that changes daily; the address is not stored. It is the only script, and `tests/e2e/no-script.spec.ts` fails on any other. The privacy page says what is sent and kept.

Why: it is the smallest change that counts real visitors without cookies or a banner. Keeping one named exception, held by a test, keeps the rest of the site free of script.

## D-025 · 2026-11-11 · /idea asks each question once

Context: the site review found that `/idea` asked the reader the same thing three ways: a "question to ask" under each of the six kinds of hidden work, the three questions with their ideas, and six signs of the mistake in a block of their own. Each kind also retold a hotel example that the story at the top already tells. The page ran to about nine screens.

Chosen, with Jan's yes on each removal: the three questions are the page's one checklist. Each question lists, one line each, the signs that a decision skipped it; the separate block of signs and its detail lines are removed. Each kind of hidden work keeps its meaning, today's example, how its loss shows and its cases in the ledger; its hotel example and its question to ask are removed. The signs to watch after an announcement stay on `/ledger`.

Why: a reader meets each idea once, in the place where it can be acted on, and the page is shorter without losing a question or a source.

## D-026 · 2026-11-12 · The desk reviews every case each week, and reads what readers send

Context: following up is what the site adds to the news, but nothing drafted updates to a published case, and nothing read the suggestions and error reports the suggest page promises to check. The drafting prompt asked for about twelve statements per case, and six cases held 19 to 29.

Chosen: a review stage. Each week every case is searched for news since its last check, cheaply, and an agent decides what to add, remove or correct only when something new was found or a reader reported an error. A review adds to the case and removes from it; it never rewrites it. What it adds passes the publishing checks, and what it removes for a correction needs Jev's agreement or a reader's report. A correction's words are written by code. Readers' suggested links are triaged with the sweep: one about an organisation in the ledger goes to that case's review, any other is assessed whatever its rank. Each suggestion is resolved in D1 with what the desk found, once the result is on master. A case body holds at most 15 statements, checked in every build.

Why: one stage serves the schedule, the news and the readers, through the same checks as a new case. Appending keeps a case's history readable in git, and code-written corrections keep a reader's or a model's words off the page. The limit of 15 sits above the prompt's twelve, so a new case has room and a long one is cut back.

## D-027 · 2026-11-12 · The site at 90% scale, 1200 pixels wide, with more air at the sides

Context: Jan, on a laptop: "the general scale of everything feels to big? ... going to 90% in my browser feels more natural somehow? i think the site needs better padding.... maybe not all sections, but some sections feel wide?" The content ran up to 1400 pixels with side margins of at most 72, so on a laptop the ledger rows spanned nearly the whole window. Shown the built pages side by side with a proposal, he chose it ("the proposed versions are better") and asked for more room between the text and the form on `/suggest`.

Chosen: the root font size is 90%, which scales every type size and space together, as the zoom he liked did. Content stops at 1200 pixels, and the side margins grow with the window up to 6rem. In a two-column section the text column ends one grid column before the side column.

Why: one value sets the scale, so the type and spacing scales keep their proportions, and the reader's own default size still counts. The narrower page answers the wide sections without changing any one of them.

## D-028 · 2026-11-12 · The weekly run releases the site, at 08:00

Context: the weekly run committed its new cases, reviews and corrections to master, but nothing deployed them; the live site changes only through `npm run release`. The desk's follow-ups would have piled up in the repository and never reached readers.

Chosen: after a weekly run lands its commit, it runs the release from its own worktree, which then matches master. The release runs every check, the build and the browser tests, and stops at the first failure. Because the release builds and runs browser tests, the schedule moves from 07:00 to 08:00, after quiet hours on this Mac.

Why: it needs no new credential, and the same release gate that guards a manual deploy guards the weekly one.

