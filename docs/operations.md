# Operations

## Domains

Both domains are registered at GoDaddy and use its name servers. DoormanFallacy.com points at GoDaddy's parking addresses; TheDoormanFallacy.com points nowhere yet (checked 2026-10-18).

Target:

| Domain | Does |
|---|---|
| thedoormanfallacy.com | Serves the site |
| www.thedoormanfallacy.com | 301 to the apex, path kept |
| doormanfallacy.com and www | 301 to https://thedoormanfallacy.com, path kept |

Steps:
1. Add both zones to Cloudflare.
2. At GoDaddy, change both domains' name servers to the pair Cloudflare gives. Only Jan can do this.
3. Add the redirect rules in Cloudflare.
4. Attach thedoormanfallacy.com to the Worker as a custom domain.

## Release

One command, `npm run release`. It stops at the first failing step.

1. Fast checks: lint, types, unit tests.
2. Build `dist/` once.
3. Site tests against that `dist/`.
4. `wrangler deploy --dry-run`, then `wrangler deploy` with the same `dist/`.

To undo: `wrangler rollback` returns the previous version. The release command prints this before it deploys.

In CI, the same steps run on every merge to `master`, and the deploy uses the `dist/` that the tests checked. Pull requests run steps 1 to 3.

## Weekly job

A scheduled GitHub Action, which passes today's date in:

- Lists cases due for review with `scripts/review-due`.
- Checks every source and archive link.
- Fetches the home page and both redirects.

It opens or updates one issue, "Ledger: due for review", and GitHub emails Jan. If the site or a redirect fails, the job fails, which also emails Jan.

## Newsletter

Buttondown holds the list ([D-003](decisions.md)). The form on the site posts to Buttondown's embed-subscribe endpoint, taken from the Buttondown dashboard at setup.

Setup:
- Turn on double opt-in.
- Send from the site's own domain, with its DNS records in Cloudflare.
- Check that unsubscribing deletes the address, and write the answer into the privacy page.

Free up to 100 subscribers. The next tier costs about $9 a month for up to 1,000 (Buttondown's pricing page, checked 2026-10-19).

## Email in

`cases@thedoormanfallacy.com` forwards to Jan through Cloudflare Email Routing. The footer's "Suggest a case" link uses it.

## Analytics

Cloudflare Web Analytics. It sets no cookies, so the site needs no cookie banner. The privacy page says so.
