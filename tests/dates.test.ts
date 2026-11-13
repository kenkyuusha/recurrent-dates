// ABOUTME: Contract for calendar-day parsing and arithmetic,
// ABOUTME: including leap days and years before 100.

import { describe, expect, it } from 'vitest';
import {
	addDays,
	dayKey,
	dayKeysFor,
	daysBetween,
	linkTargetToDateText,
	parseIsoDate,
	sameDay,
	toIso,
} from '../src/core/dates';

describe('parseIsoDate', () => {
	it('reads a strict YYYY-MM-DD date', () => {
		expect(parseIsoDate('1894-12-08')).toEqual({ year: 1894, month: 12, day: 8 });
	});

	it('accepts February 29 only in leap years', () => {
		expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
		expect(parseIsoDate('2023-02-29')).toBeNull();
		expect(parseIsoDate('1900-02-29')).toBeNull();
		expect(parseIsoDate('2000-02-29')).not.toBeNull();
	});

	it('rejects anything that is not exactly a date', () => {
		for (const text of ['1894-12-8', '1894-13-01', '1894-00-10', '0000-01-01', 'March', '1999', '2024-01-01 notes', '']) {
			expect(parseIsoDate(text)).toBeNull();
		}
	});
});

describe('formatting and keys', () => {
	it('pads every part', () => {
		expect(toIso({ year: 987, month: 1, day: 2 })).toBe('0987-01-02');
		expect(dayKey(5, 16)).toBe('05-16');
	});
});

describe('day arithmetic', () => {
	it('crosses month and year boundaries', () => {
		expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
		expect(addDays({ year: 2024, month: 3, day: 1 }, -1)).toEqual({ year: 2024, month: 2, day: 29 });
	});

	it('keeps years below 100 literal', () => {
		expect(addDays({ year: 44, month: 3, day: 15 }, 1)).toEqual({ year: 44, month: 3, day: 16 });
	});

	it('counts whole days in both directions', () => {
		const birth = { year: 1821, month: 5, day: 16 };
		const death = { year: 1894, month: 12, day: 8 };
		expect(daysBetween(birth, death)).toBe(26869);
		expect(daysBetween(death, birth)).toBe(-26869);
		expect(sameDay(birth, { ...birth })).toBe(true);
	});
});

describe('dayKeysFor', () => {
	it('returns the single key for an ordinary day', () => {
		expect(dayKeysFor(2026, 12, 8)).toEqual(['12-08']);
	});

	it('adds February 29 to February 28 in common years only', () => {
		expect(dayKeysFor(2026, 2, 28)).toEqual(['02-28', '02-29']);
		expect(dayKeysFor(2028, 2, 28)).toEqual(['02-28']);
		expect(dayKeysFor(2028, 2, 29)).toEqual(['02-29']);
	});
});

describe('linkTargetToDateText', () => {
	it('strips folders, headings, block ids and the extension', () => {
		expect(linkTargetToDateText('1894-12-08')).toBe('1894-12-08');
		expect(linkTargetToDateText('daily-notes/1894-12-08')).toBe('1894-12-08');
		expect(linkTargetToDateText('daily-notes/1894-12-08#evening')).toBe('1894-12-08');
		expect(linkTargetToDateText('1894-12-08#^abc123')).toBe('1894-12-08');
		expect(linkTargetToDateText('1894-12-08.md')).toBe('1894-12-08');
	});
});
