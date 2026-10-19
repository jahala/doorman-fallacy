# Contributing

Thank you for helping. There are two kinds of contribution, and they take different routes.

## Cases and corrections

Suggest a case through the form on [thedoormanfallacy.com/suggest](https://thedoormanfallacy.com/suggest), or report an error in one with the "Report an error" link on its page. Please do not open issues or pull requests about specific companies. Unchecked claims about named organisations stay out of this public repository until the desk has checked them against their sources ([docs/desk.md](docs/desk.md)).

Case files in `src/content/cases/` are written by the desk and must pass its checks. A pull request that edits one by hand will not be merged; report the error through the form instead, and the desk corrects the case and records the correction on its page.

## Code and design

1. Fork, branch, change.
2. Run the checks. `npm ci` sets up a pre-push hook that runs the first one for you:

   ```sh
   npm run check
   npm run build
   npm run test:site
   ```

3. Open a pull request that says what changed and why, and how you checked it.

Before writing code, read [CLAUDE.md](CLAUDE.md) and the doc for the area you are changing. A few rules carry most of the weight:

- **A test first.** A fix comes with the test that failed before it. A new rule comes with the check that enforces it, listed in [docs/engineering.md](docs/engineering.md#rules-and-their-guards).
- **Pure logic in `src/lib/`.** No clock, files or network there; pass them in. A lint rule enforces it.
- **No client-side JavaScript.** The site works as plain HTML.
- **Colours from tokens only**, in `src/styles/tokens.css`. Text meets WCAG AA in light and dark mode.
- **Plain language.** Short sentences, British spelling, no em dashes in site copy.
- **Docs stay true.** A change fixes every doc it makes false, in the same pull request.

For anything larger, such as a new page, a change to the case format, or a new desk stage, open an issue first so we can agree on the shape.

## Licence

By contributing, you agree that code you contribute is licensed under the [MIT License](LICENSE), and text under [CC BY 4.0](LICENSE-CONTENT).
