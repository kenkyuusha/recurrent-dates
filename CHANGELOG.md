# Changelog

## 0.1.2 (2026-11-14)

- Fixed: a block inside a note named after a date counted ages from the
  current year. It now counts from that note's year, so an old daily note
  keeps the point of view of its day, and later years count as future there.

## 0.1.1 (2026-11-14)

No change in behaviour.

- The Moment.js call that reads custom date formats now has its type spelled
  out, so the community directory's automated review reads the code without
  warnings.
- A contributing guide.

## 0.1.0 (2026-11-14)

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
