---
company: Example Bank
short: Example Bank
country: AU
area: Customer service
change: 45 roles cut for a voice bot.
announced: 2025-07-29
headcount: 45
door: Answering inbound calls
claims:
  - date: 2025-07-29
    who: Example Bank
    said: The voice bot would reduce call volumes.
    source: bank-notice
    quote: "the voice bot will reduce call volumes"
missed:
  - function: slack
    evidence: Call volumes rose and team leaders were answering calls.
    sources: [union-statement]
  - function: judgment
    evidence: Customers with unusual requests had nobody to escalate to.
    sources: [gazette-waits, union-statement]
updates:
  - date: 2025-07-29
    status: too-early
    summary: Roles cut as a voice bot takes inbound calls.
    sources: [bank-notice]
    quote: "the voice bot will reduce call volumes"
  - date: 2025-08-21
    status: strained
    summary: Reports of longer waits and staff working overtime.
    sources: [gazette-waits]
    quote: "customers waited longer and team leaders took calls"
corrections:
  - date: 2025-09-02
    what: Headcount corrected from 90 to 45 direct-banking roles.
suggestedBy: null
lastChecked: 2025-09-30
watch:
  queries: ["Example Bank voice bot", "Example Bank customer service jobs"]
  signals: [rehiring, call volumes, union statements]
sources:
  - id: bank-notice
    kind: primary
    url: https://example.com/notices/voice-bot
    publisher: Example Bank
    title: Notice to staff about the voice bot
    published: 2025-07-29
  - id: gazette-waits
    kind: reporting
    url: https://example.com/articles/waits
    publisher: Example Gazette
    title: Call waits grow after voice bot launch
    published: 2025-08-21
    archive: https://web.archive.org/web/20250822000000/https://example.com/articles/waits
  - id: union-statement
    kind: primary
    url: https://example.com/union/statement
    publisher: Example Finance Union
    title: Union statement on the voice bot
    published: 2025-08-10
    archive: https://web.archive.org/web/20250811000000/https://example.com/union/statement
  - id: gazette-background
    kind: reporting
    url: https://example.com/articles/background
    publisher: Example Gazette
    title: How the direct-banking team worked
    published: 2025-07-30
    archive: https://web.archive.org/web/20250731000000/https://example.com/articles/background
related: []
---

This is a test fixture. It is not a real case. Every name and address in it is made up.

## The role

The direct-banking team answered inbound calls from customers.[^gazette-background]

## The change

The bank announced that 45 roles would be cut.[^bank-notice]

## What happened next

Reporters described longer waits after the voice bot launched.[^gazette-waits]

- The union said team leaders were answering calls.[^union-statement]
- The same report put the cut at 45 roles.[^gazette-waits-2]

## Open questions

It is not yet reported whether call volumes returned to their earlier level.

[^gazette-background]: "the direct-banking team answered inbound calls from customers"
[^bank-notice]: "the voice bot will reduce call volumes"
[^gazette-waits]: "customers waited longer and team leaders took calls"
[^gazette-waits-2]: "the bank confirmed that 45 roles were affected"
[^union-statement]: "team leaders have been pulled onto the phones"
