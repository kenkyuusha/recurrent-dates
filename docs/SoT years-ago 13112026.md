# Years Ago: source of truth

- Project: Years Ago, an Obsidian community plugin (id `years-ago`)
- Owner: kenkyuusha
- Updated: 2026-11-13
- Status: 0.1.0 built and unit tested; not yet released or submitted to the
  community directory. Behaviour inside the Obsidian app (desktop and mobile)
  has not been verified yet.

User-facing behaviour is described in the [README](../README.md). This
document covers how the plugin is built and what must keep holding.

## What it does

Lists, for one calendar day, every note that links to that day in any year,
with how long ago it was. The data is the user's existing date links
(`[[1894-12-08]]`); the plugin adds no markup and never writes to notes.

## Guarantees

- **Read-only.** The plugin never modifies notes. The only file it writes is
  its own `data.json` (settings).
- **Local.** No network requests, no telemetry.
- **Mobile-safe.** No Node or Electron APIs, no regex lookbehind;
  `isDesktopOnly` is `false`.
- **Cheap startup.** Indexing uses only Obsidian's in-memory metadata cache.
  Note text is read lazily, and only for notes that have something on the day
  being shown.

## Repository map

| Path | Role |
| --- | --- |
| `src/core/` | Pure logic, no Obsidian imports. Unit tested in Node. |
| `src/core/dates.ts` | Calendar-day type, ISO parsing, day arithmetic, leap-day rule |
| `src/core/date-index.ts` | `DateIndex`: date links and dated notes grouped by `MM-DD` |
| `src/core/classify.ts` | Labels, birth/death keywords, lifespans, navigation lines |
| `src/core/snippet.ts` | Markdown line to plain snippet parts with a highlight |
| `src/core/model.ts` | `buildDayModel`: filter, classify, dedupe, group by year |
| `src/core/i18n.ts` | English and Russian strings, plural forms, day names |
| `src/indexer.ts` | `VaultIndexer`: metadata cache to `DateIndex`; lazy reads for one day |
| `src/settings.ts` | Stored settings, defaults, conversion to core settings, settings tab |
| `src/ui/render.ts` | Shared DOM rendering of a day's list |
| `src/ui/view.ts` | Sidebar `ItemView` with day navigation |
| `src/ui/codeblock.ts` | `years-ago` code block |
| `src/main.ts` | Lifecycle, vault events, commands |
| `tests/` | Vitest suites for `src/core`; `helpers/fake-vault.ts` stands in for the metadata cache |

## Data flow

```
metadata cache (links, frontmatterLinks)      note names
            │                                      │
            └────────────► VaultIndexer ◄──────────┘
                               │  setFile / removeFile
                               ▼
                           DateIndex  (MM-DD → notes; positions only)
                               │  refsOn / notesOn for the viewed day
                               ▼
        vault.cachedRead (only the notes found) ──► buildDayModel
                               │
                               ▼
                 renderDay ──► sidebar view, code blocks
```

The index is rebuilt once the workspace layout is ready and then kept current
from `metadataCache.on('changed')`, `vault.on('delete')` and
`vault.on('rename')`. Views refresh on a 400 ms debounce and when the local
date changes (checked every minute).

## Rules that must not regress

Each rule has tests in `tests/`.

- A date link is any link whose target note name parses with the configured
  format; folders, headings, block ids and aliases are ignored for parsing.
- In a dated note, a link to its own or an adjacent day on a line with at most
  24 other letters or digits is navigation and is not listed. The same link in
  a longer sentence is listed.
- A dated note is listed as a "daily note" entry only if it contains something
  other than such navigation lines, and never for the viewed year itself.
- `label: [[date]]` lines are skipped when the normalized label is in the
  ignore list.
- Birth/death: the keyword nearest before the link wins; otherwise two
  dash-joined date links 1 to 125 years apart are birth then death.
- One entry per note and date, with a count of further lines mentioning it.
- February 29 entries are shown on February 28 in common years.
- "N years ago" is the viewed year minus the linked year; Russian uses the
  three plural forms.

## Compatibility

- `minAppVersion` is 1.8.7 (`getLanguage`, `loadLocalStorage`).
- Settings are declared through `getSettingDefinitions()` for Obsidian 1.13+
  and rendered by `display()` on older versions, from one shared description.
- The date format setting accepts any Moment.js pattern; the default
  `YYYY-MM-DD` takes a fast path without Moment.

## Run and verify

```bash
npm install
npm test
npm run lint
npm run build
```

Manual check: copy `main.js`, `manifest.json` and `styles.css` to
`<vault>/.obsidian/plugins/years-ago/`, enable the plugin, and open the panel.

## Release

`npm version <patch|minor|major>` updates `package.json`, `manifest.json` and
`versions.json`. Pushing the tag (no `v` prefix) runs
`.github/workflows/release.yml`, which builds and attaches the three files to
a draft release. Submission to the community directory happens through
community.obsidian.md and reads `manifest.json` from the default branch.

## Open questions

- Plugin name and id are working choices. The id cannot change after the first
  public release.
- Calendar markers: the Calendar plugin (1.5.10) exposes no public hook for
  other plugins to add day markers, so this is not implemented.
- Custom date formats that include folders (for example `YYYY/MM/DD`) are not
  supported; only the note name is parsed.
