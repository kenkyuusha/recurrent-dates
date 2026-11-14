# Changelog

## 0.1.0 (unreleased)

First version.

- "On this day" sidebar panel listing every note that links to the selected
  calendar day in any year, with day navigation.
- `recurrent-dates` code block that embeds the same list in a note. Its header
  collapses and expands the list and shows the number of entries; the state
  is remembered per note on each device, and `collapsed: true` sets the
  starting state.
- Birth and death detection from keywords and from `[[date]] - [[date]]`
  lifespans.
- Filters for daily-note navigation lines, ignored labels, excluded folders
  and future years.
- English and Russian interface text.
