// ABOUTME: Contract for reading the meaning of a date link from its line:
// ABOUTME: labels, birth/death keywords, lifespans, and daily-note navigation.

import { describe, expect, it } from 'vitest';
import {
	detectKind,
	findDateSpans,
	hasMeaningfulContent,
	isNavigationLine,
	keywordKind,
	labelBefore,
	normalizeLabel,
} from '../src/core/classify';
import { parseLinkDate, TEST_SETTINGS } from './helpers/fake-vault';

const keywords = TEST_SETTINGS.keywords;

function kindsOf(line: string, lifespanPairs = true): string[] {
	const spans = findDateSpans(line, parseLinkDate);
	return spans.map((span) => detectKind(line, span, spans, keywords, lifespanPairs));
}

describe('labelBefore', () => {
	const label = (line: string) => labelBefore(line, line.indexOf('[['));

	it('reads the label of a "label: [[date]]" line', () => {
		expect(label('date added: [[2012-03-04]]')).toBe('date added');
		expect(label('first reading: [[2017-12-08]] ')).toBe('first reading');
	});

	it('ignores list markers, emphasis and decoration around the label', () => {
		expect(label('**date**: [[2012-06-21]]')).toBe('date');
		expect(label('    - born: [[1907-04-25]]')).toBe('born');
		expect(label('🗓️ день рождения: [[1990-07-04]]')).toBe('день рождения');
		expect(label('Created: **[[2012-01-05]]**')).toBe('created');
	});

	it('returns null when the link is not right after a label', () => {
		expect(label('March 3, 2012 → [[2012-03-03]]')).toBeNull();
		expect(label('due in a month ([[2012-07-19]])')).toBeNull();
		expect(label('[[1821-05-16]] - [[1894-12-08]]')).toBeNull();
		expect(label('当日: **Thursday**, [[1931-03-12]]')).toBeNull();
	});
});

describe('normalizeLabel', () => {
	it('makes typed settings comparable with labels found in notes', () => {
		expect(normalizeLabel('  Date Added ')).toBe('date added');
		expect(normalizeLabel('**Created**')).toBe('created');
	});
});

describe('keywordKind', () => {
	it('matches whole words in spaced scripts', () => {
		expect(keywordKind('mathematician, born on ', keywords)).toBe('birth');
		expect(keywordKind('a rebirth of interest on ', keywords)).toBeNull();
		expect(keywordKind('birthplace: ', keywords)).toBeNull();
		expect(keywordKind('русский математик, родился ', keywords)).toBe('birth');
		expect(keywordKind('зародился ', keywords)).toBeNull();
	});

	it('matches substrings in scripts without spaces', () => {
		expect(keywordKind('東京で生まれた ', keywords)).toBe('birth');
	});

	it('lets the keyword nearest the link win', () => {
		expect(keywordKind('born in Trieste, died on ', keywords)).toBe('death');
		expect(keywordKind('died young; her daughter was born ', keywords)).toBe('birth');
	});
});

describe('detectKind', () => {
	it('reads two dash-joined dates as a lifespan', () => {
		expect(kindsOf('[[1821-05-16]] - [[1894-12-08]] ')).toEqual(['birth', 'death']);
		expect(kindsOf('Pafnuty Chebyshev ([[1821-05-16]] – [[1894-12-08]])')).toEqual(['birth', 'death']);
	});

	it('does not read short or implausible ranges as a lifespan', () => {
		expect(kindsOf('trip: [[2012-01-02]] - [[2012-01-10]]')).toEqual(['event', 'event']);
		expect(kindsOf('[[1500-01-01]] - [[1900-01-01]]')).toEqual(['event', 'event']);
		expect(kindsOf('[[1894-12-08]] - [[1821-05-16]]')).toEqual(['event', 'event']);
	});

	it('can have lifespan reading switched off', () => {
		expect(kindsOf('[[1821-05-16]] - [[1894-12-08]]', false)).toEqual(['event', 'event']);
	});

	it('uses keywords on the same line, per link', () => {
		expect(kindsOf('born on [[1868-02-11]] in [[trieste]], died on [[1941-10-30]]')).toEqual(['birth', 'death']);
		expect(kindsOf('she was born [[1990-07-04]]')).toEqual(['birth']);
		expect(kindsOf('родилась: [[1931-03-12]]')).toEqual(['birth']);
	});

	it('falls back to a plain event', () => {
		expect(kindsOf('first reading: [[2017-12-08]]')).toEqual(['event']);
		expect(kindsOf('met at the conference on [[2012-06-01]] and again on [[2012-06-03]]')).toEqual(['event', 'event']);
	});
});

describe('isNavigationLine', () => {
	it('recognizes lines that only link between days', () => {
		expect(isNavigationLine('前日: [[1894-12-07]]')).toBe(true);
		expect(isNavigationLine('当日: **Saturday**, [[1894-12-08]]')).toBe(true);
		expect(isNavigationLine('<< [[2024-01-01]] | [[2024-01-03]] >>')).toBe(true);
		expect(isNavigationLine('Yesterday: [[2024-01-01]] Tomorrow: [[2024-01-03]]')).toBe(true);
	});

	it('keeps lines that say something', () => {
		expect(isNavigationLine('we walked to the lighthouse on [[2012-08-06]] and it rained the whole way back')).toBe(false);
	});
});

describe('hasMeaningfulContent', () => {
	const own = { year: 1894, month: 12, day: 8 };
	const check = (text: string) => hasMeaningfulContent(text.split('\n'), own, parseLinkDate);

	it('is false for a note that only navigates to its neighbours', () => {
		expect(check('前日: [[1894-12-07]]\n当日: **Saturday**, [[1894-12-08]]\n翌日: [[1894-12-09]]\n\n')).toBe(false);
		expect(check('---\ntags: daily\n---\n前日: [[1894-12-07]]\n')).toBe(false);
		expect(check('')).toBe(false);
	});

	it('is true once the note says anything else', () => {
		expect(check('前日: [[1894-12-07]]\nread about approximation theory')).toBe(true);
		expect(check('前日: [[1894-12-07]]\n- [ ] [[some note]]')).toBe(true);
		expect(check('see also [[1821-05-16]]')).toBe(true);
	});
});
