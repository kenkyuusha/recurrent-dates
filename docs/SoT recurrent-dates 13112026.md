# Recurrent Dates: source of truth

- Project: Recurrent Dates, an Obsidian community plugin (id `recurrent-dates`)
- Owner: kenkyuusha
- Updated: 2026-11-14
- Status: 0.1.0 built and unit tested; source published on GitHub, no release
  yet, not submitted to the community directory. Seen working in the app on
  2026-11-14: the sidebar panel on desktop Obsidian 1.15.0 and the
  `recurrent-dates` code block on Obsidian mobile (iOS). Not yet checked in
  the app: opening an entry, day navigation, the settings tab, the sidebar
  panel on mobile, and collapsing the code block (its layout was checked only
  on a rendering stand outside the app).

User-facing behaviour is described in the [README](../README.md). This
document covers how the plugin is built and what must keep holding.

## What it does

Lists, for one calendar day, every note that links to that day in any year,
with how long ago it was. The data is the user's existing date links
(`[[1894-12-08]]`); the plugin adds no markup and never writes to notes.

## Guarantees

- **Read-only.** The plugin never modifies notes. It writes its own
  `data.json` (settings) and two device-local entries through
  `App.saveLocalStorage`: a flag that the panel was added to the sidebar, and
  the fold state of embedded blocks.
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
| `src/core/block-options.ts` | Options written inside the code block (`date`, `collapsed`) |
| `src/core/fold-memory.ts` | `BlockFoldMemory`: which blocks the reader collapsed, bounded |
| `src/core/constants.ts` | Names shared by the core and the Obsidian layer |
| `src/indexer.ts` | `VaultIndexer`: metadata cache to `DateIndex`; lazy reads for one day |
| `src/settings.ts` | Stored settings, defaults, conversion to core settings, settings tab |
| `src/ui/render.ts` | Shared DOM rendering of a day's list |
| `src/ui/view.ts` | Sidebar `ItemView` with day navigation |
| `src/ui/codeblock.ts` | `recurrent-dates` code block with its collapsible header |
| `src/main.ts` | Lifecycle, vault events, commands |
| `tests/` | Vitest suites for `src/core`; `helpers/fake-vault.ts` stands in for the metadata cache |
| `docs/images/` | README images, rendered from the plugin's own code with invented demo notes |

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
- A block starts in the state its `collapsed` option names, expanded when
  there is none. A toggle is remembered per note and block options, on that
  device only, and only while it differs from that starting state; at most
  300 blocks are remembered, oldest dropped first.
- The plugin's own code block never counts as content of a dated note.

## Test data, examples and images

Fixtures, documentation examples and README images use invented entries or
well-known public facts. Nothing is copied from a real vault, and screenshots
of a real vault are not committed. Commits are made with a GitHub noreply
address.

## Interface conventions borrowed from the app

These are Obsidian internals rather than documented API, checked against the
app's own code and stylesheet in 1.15.0:

- The fold arrow is the app's own: icon `right-triangle` in an element with
  class `collapse-icon`, rotated by the app when it also has `is-collapsed`.
  `styles.css` repeats size and rotation only as zero-specificity fallbacks.
- Clickable parts carry the class `interactive-child`, which the editor's
  click handler for embedded blocks skips, and their click handlers call
  `preventDefault()`, which that handler also respects.
- In the editor the app overlays an "edit this block" button on the block's
  top corner; the block header keeps `--size-4-10` of space free for it.

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
`<vault>/.obsidian/plugins/recurrent-dates/`, enable the plugin, and open the panel.

## Release

`npm version <patch|minor|major>` updates `package.json`, `manifest.json` and
`versions.json`. Pushing the tag (no `v` prefix) runs
`.github/workflows/release.yml`, which builds, signs a build provenance
attestation and attaches the three files to a draft release; the draft then
has to be published by hand. Submission to the community directory happens
through community.obsidian.md and reads `manifest.json` from the default
branch. The release workflow has not run yet. The plugin id
(`recurrent-dates`) cannot change after the first public release.

Pushing workflow files over HTTPS needs a GitHub token with the `workflow`
scope.

## Open questions

- Calendar markers: the Calendar plugin (1.5.10) exposes no public hook for
  other plugins to add day markers, so this is not implemented.
- Custom date formats that include folders (for example `YYYY/MM/DD`) are not
  supported; only the note name is parsed.
