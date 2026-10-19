# The Doorman Fallacy

The source of [TheDoormanFallacy.com](https://thedoormanfallacy.com): an explanation of Rory Sutherland's doorman fallacy, and a sourced ledger of what happened after companies cut roles for AI.

## Run it

Needs Node 26 (see `.nvmrc`).

```sh
npm ci
npm run dev        # local site
npm run check      # lint, types, unit tests, copy and docs checks
npm run build      # static site into dist/
npm run test:site  # browser checks against dist/
```

## How it is built

Start with [CLAUDE.md](CLAUDE.md). Architecture, the case format, design and decisions are in [docs/](docs/).

## Credits

The doorman fallacy is Rory Sutherland's idea, from *Alchemy* (2019). Photographs by atelierbyvineeth and Maryam Tello, from Unsplash.

Curated by Jan Hallvard Larsen.
