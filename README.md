# Recurrent Dates

An [Obsidian](https://obsidian.md) plugin that shows what happened on this day
in any year, using the dates you already link in your notes.

If a note about a mathematician says `[[1821-05-16]] - [[1894-12-08]]`, then
every December 8 the panel lists that note under "132 years ago" (and counting).
Nothing has to be tagged or moved into frontmatter: a link to a date is enough.

## What it shows

For the selected day, Recurrent Dates lists every note that links to that calendar
day in any year, grouped by year:

- the note's name and how long ago the date was;
- the line the link sits on, with the matched date highlighted;
- a **born** or **died** badge when the line says so;
- daily notes written on the same day in other years.

Selecting an entry opens the note at that line. With the Page preview core
plugin on, holding Ctrl or Cmd while hovering shows a preview.

## Where it shows

- **Sidebar panel.** Run **Open on this day** from the command palette or use
  the ribbon icon. The panel follows today and has arrows to step to
  neighbouring days. It works on desktop and mobile.
- **Inside a note.** Add a `recurrent-dates` code block, for example to your daily
  note template:

  ````markdown
  ```recurrent-dates
  ```
  ````

  In a note named after a date the block shows that day; anywhere else it
  shows today. To pin it to a day, add `date: 12-08` or `date: 1894-12-08`.

## How dates are recognized

A date is any link to a note whose name matches your date format
(`YYYY-MM-DD` by default), such as `[[1894-12-08]]`,
`[[daily/1894-12-08|8 Dec]]` or a link in a property. The dated note does not
have to exist.

Some links are left out on purpose:

- **Daily note navigation.** In a note named after a date, a line that only
  links to that day or the days next to it ("yesterday / today / tomorrow") is
  ignored. A real sentence that mentions yesterday is kept.
- **Bookkeeping lines.** A line written as `label: [[date]]` is skipped when
  the label is on the ignore list (`created`, `date added`, `saved`,
  `modified` and similar by default).
- **Future years**, unless you turn them on.

February 29 entries appear on February 28 in years without a leap day.

### Births and deaths

A date is marked **born** or **died** when a keyword such as "born", "died",
"родился" or "умер" comes before it on the same line; the keyword closest to
the date wins. Without a keyword, two dates joined by a dash and 1 to 125
years apart are read as a lifespan: the first is the birth, the second the
death. Both rules can be adjusted or switched off in settings.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| Date format | `YYYY-MM-DD` | Moment.js pattern of date link targets and daily note names |
| Show daily notes from other years | on | List notes named after this day, unless they only hold navigation |
| Show future years | off | Include dates in years after the current one |
| Newest year first | off | Reverse the order of years |
| Ignored labels | `created, date added, saved, …` | Labels of `label: [[date]]` lines to skip |
| Excluded folders | none | Folders whose notes are left out, one per line |
| Read date pairs as lifespans | on | Treat `[[date]] - [[date]]` as birth and death |
| Birth keywords, Death keywords | English, Russian, Japanese | Words that mark a date as a birth or a death |

The panel title, age wording and badges follow Obsidian's language for English
and Russian; other languages fall back to English.

## Privacy

Recurrent Dates works entirely inside your vault. It makes no network requests,
collects nothing, and never modifies your notes. It reads link positions from
Obsidian's metadata cache and reads note text only for the day being shown.

## Installing

Until the plugin is in the community directory, install it by hand:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest
   release.
2. Put them in `<your vault>/.obsidian/plugins/recurrent-dates/`.
3. In Obsidian, open **Settings → Community plugins**, reload the list and
   enable **Recurrent Dates**.

Requires Obsidian 1.8.7 or newer.

## Development

```bash
npm install
npm run dev     # watch and rebuild main.js
npm test        # unit tests for the date logic
npm run lint    # Obsidian's ESLint rules
npm run build   # type-check and produce a production main.js
```

The date logic lives in `src/core` and has no dependency on Obsidian, so it is
tested in plain Node. See [the architecture notes](docs/SoT%20recurrent-dates%2013112026.md)
for how the pieces fit together.

To cut a release, run `npm version patch` (or `minor` / `major`) and push the
tag. The release workflow builds the plugin and attaches the three files to a
draft GitHub release.

## License

[MIT](LICENSE)
