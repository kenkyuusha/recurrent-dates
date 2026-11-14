// ABOUTME: Contract for the options written inside a `recurrent-dates` code block:
// ABOUTME: which day to show and whether the block starts collapsed.

import { describe, expect, it } from 'vitest';
import { parseBlockSource, resolveBlockView } from '../src/core/block-options';

describe('parseBlockSource', () => {
	it('needs no options at all', () => {
		expect(parseBlockSource('')).toEqual({ day: null });
		expect(parseBlockSource('\n  \n')).toEqual({ day: null });
	});

	it('reads a bare day or a full date', () => {
		expect(parseBlockSource('date: 12-08')).toEqual({ day: { month: 12, day: 8 } });
		expect(parseBlockSource('date: 1894-12-08')).toEqual({ day: { year: 1894, month: 12, day: 8 } });
		expect(parseBlockSource('date: 02-29')).toEqual({ day: { month: 2, day: 29 } });
	});

	it('reads the initial fold state', () => {
		expect(parseBlockSource('collapsed: true')).toEqual({ day: null, collapsed: true });
		expect(parseBlockSource('collapsed: false')).toEqual({ day: null, collapsed: false });
	});

	it('accepts several options, in any letter case and spacing', () => {
		expect(parseBlockSource('Date : 12-08\n  COLLAPSED:True  ')).toEqual({
			day: { month: 12, day: 8 },
			collapsed: true,
		});
	});

	it('explains what it could not read', () => {
		expect(parseBlockSource('date: tomorrow')).toEqual({ error: 'Not a date: tomorrow' });
		expect(parseBlockSource('date: 13-40')).toEqual({ error: 'Not a date: 13-40' });
		expect(parseBlockSource('collapsed: maybe')).toEqual({ error: 'Use true or false for collapsed, not: maybe' });
		expect(parseBlockSource('sort: newest')).toEqual({ error: 'Unknown option: sort: newest' });
		expect(parseBlockSource('just some text')).toEqual({ error: 'Unknown option: just some text' });
	});
});

describe('resolveBlockView', () => {
	const today = { year: 2026, month: 11, day: 14 };
	const oldDailyNote = { year: 2024, month: 9, day: 16 };

	it('shows today in a note that is not named after a date', () => {
		expect(resolveBlockView({ day: null }, null, today)).toEqual({ year: 2026, month: 11, day: 14 });
	});

	it("shows a dated note's own day as seen from that note's year", () => {
		expect(resolveBlockView({ day: null }, oldDailyNote, today)).toEqual({ year: 2024, month: 9, day: 16 });
	});

	it('counts from the current year for a bare day in the options, whatever the note is called', () => {
		expect(resolveBlockView({ day: { month: 12, day: 8 } }, null, today)).toEqual({ year: 2026, month: 12, day: 8 });
		expect(resolveBlockView({ day: { month: 12, day: 8 } }, oldDailyNote, today)).toEqual({
			year: 2026,
			month: 12,
			day: 8,
		});
	});

	it('counts from the year of a full date in the options', () => {
		expect(resolveBlockView({ day: { year: 1894, month: 12, day: 8 } }, oldDailyNote, today)).toEqual({
			year: 1894,
			month: 12,
			day: 8,
		});
	});
});
