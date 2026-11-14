# Contributing to Recurrent Dates

Bug reports, ideas and pull requests are welcome.

## Reporting a problem

Open an issue and include:

- what you expected to see and what you saw instead;
- for a date that is read wrongly, the line itself, with anything private
  replaced by something made up;
- your Obsidian version, your platform, the plugin version and your **Date
  format** setting.

Please do not paste real notes. A single line with invented names is enough to
reproduce almost everything this plugin does.

## Working on the code

You need Node.js 22 or newer.

```bash
npm install
npm run dev     # watch and rebuild main.js
npm test        # unit tests for the date logic
npm run lint    # the rule set of Obsidian's automated review
npm run build   # type-check and produce a production main.js
```

To try a build, copy `main.js`, `manifest.json` and `styles.css` to
`<your vault>/.obsidian/plugins/recurrent-dates/` and reload the plugin.

How the code is laid out:

- `src/core/` holds the date logic. It imports nothing from Obsidian and is
  covered by the tests in `tests/`.
- `src/indexer.ts`, `src/main.ts`, `src/settings.ts` and `src/ui/` are the thin
  layer that connects that logic to Obsidian.
- The [architecture notes](docs/SoT%20recurrent-dates%2013112026.md) list the
  rules that must keep holding.

What a change needs:

- **A test for a change in behaviour.** Write the failing test first, then the
  code.
- **Invented test data.** Fixtures, examples and images use made-up entries or
  well-known public facts. Nothing is copied from anyone's vault.
- **A clean `npm run lint` and `npm run build`.** The project type-checks with
  `esModuleInterop`, the way the community directory's review does. Under that
  option the `moment` export from `obsidian` is not callable, so Moment.js is
  reached through the typed helper in `src/indexer.ts`.
- **Both languages.** Interface text lives in `src/core/i18n.ts`, in English
  and Russian.
- **Conventional Commits** for commit messages, for example
  `fix(core): ...` or `docs: ...`.

## Releasing

For maintainers:

1. Update `CHANGELOG.md`.
2. Run `npm version patch` (or `minor` / `major`). It updates `package.json`,
   `manifest.json` and `versions.json`.
3. Push the commit and the tag. The tag has no `v` prefix.
4. The release workflow tests, builds, attests the three files and creates a
   draft release. Check it and publish it.
