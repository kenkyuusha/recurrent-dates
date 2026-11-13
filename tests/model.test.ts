// ABOUTME: Contract for what one calendar day shows: which links survive,
// ABOUTME: how they are labelled, grouped by year and ordered.

import { describe, expect, it } from 'vitest';
import { dayKeysFor } from '../src/core/dates';
import { buildDayModel, isInFolders, noteTitle, type CoreSettings, type DayModel } from '../src/core/model';
import { fakeVault, parseLinkDate, TEST_SETTINGS } from './helpers/fake-vault';

function modelFor(
	notes: Record<string, string>,
	year: number,
	month: number,
	day: number,
	overrides: Partial<CoreSettings> = {},
): DayModel {
	const vault = fakeVault(notes);
	const keys = dayKeysFor(year, month, day);
	return buildDayModel({
		year,
		month,
		day,
		refs: vault.index.refsOn(keys),
		notes: vault.index.notesOn(keys),
		lines: vault.lines,
		ownDateOf: vault.ownDateOf,
		parseLinkDate,
		settings: { ...TEST_SETTINGS, ...overrides },
	});
}

function summary(model: DayModel): string[] {
	return model.groups.flatMap((group) =>
		group.entries.map((entry) => `${group.year} (${group.yearsAgo}) ${entry.kind} ${entry.title}`),
	);
}

const VAULT: Record<string, string> = {
	'scientists/pafnuty chebyshev.md': '---\naliases:\n  - chebyshev\n---\n[[1821-05-16]] - [[1894-12-08]] \n\na russian mathematician',
	'projects/weather station.md': 'a weather station on the roof\n\nfirst reading: [[2017-12-08]] ',
	'companies/acme.md': 'created: [[2025-12-08]]\nfounded by two people',
	'journal/plans.md': 'renewal due on [[2027-12-08]]',
	'daily/1894-12-08.md': '前日: [[1894-12-07]]\n当日: **Saturday**, [[1894-12-08]]\n翌日: [[1894-12-09]]\n',
	'daily/2024-12-08.md': '前日: [[2024-12-07]]\n当日: **Sunday**, [[2024-12-08]]\n翌日: [[2024-12-09]]\n\nlong walk by the river',
	'daily/2024-12-09.md': '前日: [[2024-12-08]]\n当日: **Monday**, [[2024-12-09]]\n\nyesterday ([[2024-12-08]]) I finally finished the draft and sent it out',
	'daily/2026-12-08.md': '前日: [[2026-12-07]]\n当日: **Tuesday**, [[2026-12-08]]\n\nsomething written today',
};

describe('buildDayModel', () => {
	it('lists the day across years, oldest first, with years counted from the viewed year', () => {
		expect(summary(modelFor(VAULT, 2026, 12, 8))).toEqual([
			'1894 (132) death pafnuty chebyshev',
			'2017 (9) event weather station',
			'2024 (2) event 2024-12-09',
			'2024 (2) note 2024-12-08',
		]);
	});

	it('shows a birth on the birth day of the same lifespan line', () => {
		expect(summary(modelFor(VAULT, 2026, 5, 16))).toEqual(['1821 (205) birth pafnuty chebyshev']);
	});

	it('can list the newest year first', () => {
		const years = modelFor(VAULT, 2026, 12, 8, { newestFirst: true }).groups.map((group) => group.year);
		expect(years).toEqual([2024, 2017, 1894]);
	});

	it('drops daily-note navigation but keeps a real sentence that links to yesterday', () => {
		const model = modelFor(VAULT, 2026, 12, 8);
		const fromDaily = model.groups.flatMap((group) => group.entries).filter((entry) => entry.path.startsWith('daily/'));
		expect(fromDaily.map((entry) => `${entry.kind} ${entry.title} line ${entry.line}`)).toEqual([
			'event 2024-12-09 line 3',
			'note 2024-12-08 line -1',
		]);
	});

	it('hides a dated note that holds nothing but navigation', () => {
		const titles = summary(modelFor(VAULT, 2026, 12, 8));
		expect(titles.some((line) => line.includes('1894-12-08'))).toBe(false);
	});

	it('never lists the note of the viewed day itself', () => {
		expect(summary(modelFor(VAULT, 2026, 12, 8)).some((line) => line.includes('2026-12-08'))).toBe(false);
	});

	it('can leave dated notes out entirely', () => {
		const kinds = modelFor(VAULT, 2026, 12, 8, { showDatedNotes: false }).groups.flatMap((group) =>
			group.entries.map((entry) => entry.kind),
		);
		expect(kinds).not.toContain('note');
	});

	it('skips lines whose label is on the ignore list', () => {
		expect(summary(modelFor(VAULT, 2026, 12, 8)).some((line) => line.includes('acme'))).toBe(false);
		expect(summary(modelFor(VAULT, 2026, 12, 8, { ignoredLabels: [] }))).toContain('2025 (1) event acme');
	});

	it('hides future years unless asked', () => {
		expect(summary(modelFor(VAULT, 2026, 12, 8)).some((line) => line.includes('plans'))).toBe(false);
		expect(summary(modelFor(VAULT, 2026, 12, 8, { showFuture: true }))).toContain('2027 (-1) event plans');
	});

	it('leaves out excluded folders', () => {
		const lines = summary(modelFor(VAULT, 2026, 12, 8, { excludedFolders: ['projects', 'daily'] }));
		expect(lines).toEqual(['1894 (132) death pafnuty chebyshev']);
	});

	it('highlights the matched date in the snippet', () => {
		const entry = modelFor(VAULT, 2026, 12, 8).groups[0]?.entries[0];
		expect(entry?.snippet).toEqual([
			{ text: '1821-05-16 - ', highlight: false },
			{ text: '1894-12-08', highlight: true },
		]);
		expect(entry?.line).toBe(4);
	});

	it('shows one entry per note and date, counting further mentions', () => {
		const model = modelFor(
			{ 'trip.md': 'left on [[2020-03-01]]\nsome text\nthe [[2020-03-01]] flight was late\n[[2020-03-01]] again [[2020-03-01]]' },
			2026,
			3,
			1,
		);
		const entries = model.groups.flatMap((group) => group.entries);
		expect(entries).toHaveLength(1);
		expect(entries[0]?.line).toBe(0);
		expect(entries[0]?.extraMentions).toBe(2);
		expect(model.total).toBe(1);
	});

	it('shows February 29 entries on February 28 of common years', () => {
		const notes = { 'leap.md': 'born on [[1996-02-29]]' };
		expect(summary(modelFor(notes, 2026, 2, 28))).toEqual(['1996 (30) birth leap']);
		expect(summary(modelFor(notes, 2028, 2, 28))).toEqual([]);
		expect(summary(modelFor(notes, 2028, 2, 29))).toEqual(['1996 (32) birth leap']);
	});

	it('labels links to the viewed year as year zero', () => {
		const notes = { 'log.md': 'session: [[2031-03-20]]' };
		expect(summary(modelFor(notes, 2031, 3, 20))).toEqual(['2031 (0) event log']);
	});

	it('reads property links from their property name', () => {
		const vault = fakeVault({});
		const model = buildDayModel({
			year: 2026,
			month: 4,
			day: 25,
			refs: [
				{ path: 'people/a.md', date: { year: 1907, month: 4, day: 25 }, line: -1, col: -1, endCol: -1, display: '1907-04-25', key: 'born' },
				{ path: 'people/b.md', date: { year: 2020, month: 4, day: 25 }, line: -1, col: -1, endCol: -1, display: '2020-04-25', key: 'Created' },
			],
			notes: [],
			lines: vault.lines,
			ownDateOf: vault.ownDateOf,
			parseLinkDate,
			settings: TEST_SETTINGS,
		});
		expect(summary(model)).toEqual(['1907 (119) birth a']);
		expect(model.groups[0]?.entries[0]?.snippet).toEqual([
			{ text: 'born: ', highlight: false },
			{ text: '1907-04-25', highlight: true },
		]);
	});

	it('still lists a link when the note text cannot be read', () => {
		const model = buildDayModel({
			year: 2026,
			month: 1,
			day: 2,
			refs: [{ path: 'gone.md', date: { year: 2001, month: 1, day: 2 }, line: 7, col: 0, endCol: 14, display: '2001-01-02' }],
			notes: [],
			lines: () => null,
			ownDateOf: () => null,
			parseLinkDate,
			settings: TEST_SETTINGS,
		});
		expect(summary(model)).toEqual(['2001 (25) event gone']);
	});
});

describe('path helpers', () => {
	it('derives the title from the path', () => {
		expect(noteTitle('scientists/pafnuty chebyshev.md')).toBe('pafnuty chebyshev');
		expect(noteTitle('top.md')).toBe('top');
	});

	it('matches whole folders only', () => {
		expect(isInFolders('daily/2024-01-01.md', ['daily'])).toBe(true);
		expect(isInFolders('daily-archive/2024-01-01.md', ['daily'])).toBe(false);
		expect(isInFolders('a/b/c.md', ['a/b'])).toBe(true);
		expect(isInFolders('a.md', [''])).toBe(false);
	});
});
