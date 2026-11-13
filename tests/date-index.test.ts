// ABOUTME: Contract for the in-memory index: notes can be added, replaced,
// ABOUTME: renamed and removed without leaving stale entries behind.

import { describe, expect, it } from 'vitest';
import { DateIndex } from '../src/core/date-index';
import { scanNote } from './helpers/fake-vault';

describe('DateIndex', () => {
	it('finds links by calendar day regardless of year', () => {
		const index = new DateIndex();
		index.setFile('a.md', scanNote('a.md', '[[1821-05-16]] - [[1894-12-08]]'), null);
		index.setFile('b.md', scanNote('b.md', 'first reading: [[2017-12-08]]'), null);

		expect(index.refsOn(['12-08']).map((ref) => `${ref.path} ${ref.date.year}`).sort()).toEqual([
			'a.md 1894',
			'b.md 2017',
		]);
		expect(index.refsOn(['05-16']).map((ref) => ref.date.year)).toEqual([1821]);
		expect(index.refsOn(['01-01'])).toEqual([]);
	});

	it('replaces a note without keeping its old links', () => {
		const index = new DateIndex();
		index.setFile('a.md', scanNote('a.md', '[[2020-03-01]]'), null);
		index.setFile('a.md', scanNote('a.md', '[[2020-04-02]]'), null);

		expect(index.refsOn(['03-01'])).toEqual([]);
		expect(index.refsOn(['04-02'])).toHaveLength(1);
		expect(index.stats()).toMatchObject({ notesWithLinks: 1, links: 1, days: 1 });
	});

	it('forgets a removed note completely', () => {
		const index = new DateIndex();
		index.setFile('daily/2024-12-08.md', scanNote('daily/2024-12-08.md', '[[2024-12-07]]'), {
			year: 2024,
			month: 12,
			day: 8,
		});
		index.removeFile('daily/2024-12-08.md');

		expect(index.refsOn(['12-07'])).toEqual([]);
		expect(index.notesOn(['12-08'])).toEqual([]);
		expect(index.ownDateOf('daily/2024-12-08.md')).toBeNull();
		expect(index.stats()).toEqual({ notesWithLinks: 0, links: 0, datedNotes: 0, days: 0 });
	});

	it('tracks notes that are named after a date', () => {
		const index = new DateIndex();
		index.setFile('daily/2024-12-08.md', [], { year: 2024, month: 12, day: 8 });
		index.setFile('daily/2025-12-08.md', [], { year: 2025, month: 12, day: 8 });

		expect(index.notesOn(['12-08']).map((note) => note.date.year).sort()).toEqual([2024, 2025]);
		expect(index.ownDateOf('daily/2025-12-08.md')).toEqual({ year: 2025, month: 12, day: 8 });
	});

	it('returns only the requested days when a note links to several', () => {
		const index = new DateIndex();
		index.setFile('a.md', scanNote('a.md', '[[2020-02-28]] and [[2020-02-29]] and [[2020-07-04]]'), null);

		expect(index.refsOn(['02-28', '02-29']).map((ref) => ref.date.day).sort()).toEqual([28, 29]);
	});

	it('can be emptied', () => {
		const index = new DateIndex();
		index.setFile('a.md', scanNote('a.md', '[[2020-03-01]]'), null);
		index.clear();
		expect(index.refsOn(['03-01'])).toEqual([]);
	});
});
