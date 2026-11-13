// ABOUTME: Reads the line around a date link to decide what the date means:
// ABOUTME: a birth, a death, plain navigation between daily notes, or bookkeeping to skip.

import { daysBetween, type DayDate } from './dates';

export type RefKind = 'birth' | 'death' | 'event';

/** Where a link sits on its line: 0-based start column and the column just past it. */
export interface Span {
	col: number;
	endCol: number;
}

export interface DateSpan extends Span {
	date: DayDate;
}

export interface KeywordSets {
	birth: string[];
	death: string[];
}

/**
 * A line in a daily note that links only to its own or neighbouring days and
 * carries at most this many other letters or digits is treated as navigation
 * ("yesterday / today / tomorrow"), not as something that happened.
 */
export const NAV_LINE_MAX_OTHER_CHARS = 24;

const MIN_LIFESPAN_DAYS = 365;
const MAX_LIFESPAN_DAYS = 125 * 366;
const MAX_LABEL_LENGTH = 40;

const WIKILINK = /!?\[\[([^\]\n]+?)\]\]/g;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LETTERS_AND_DIGITS = /[\p{L}\p{N}]/gu;
const RANGE_JOINER = /^\s*[-‐-―−]\s*$/;
// Keywords in scripts that separate words with spaces get whole-word matching.
// Others (Japanese, Chinese) are matched as plain substrings.
const SPACED_SCRIPT = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}\s.'’-]+$/u;

/** Lowercases a label and strips list markers, emphasis and decoration around it. */
export function normalizeLabel(raw: string): string {
	return raw
		.replace(/[*_=~`]/g, '')
		.replace(/^[^\p{L}\p{N}]+/u, '')
		.replace(/[^\p{L}\p{N}]+$/u, '')
		.replace(/\s+/g, ' ')
		.toLowerCase();
}

/**
 * The label of a `label: [[link]]` line, normalized, or null when the link is
 * not directly preceded by a label and a colon.
 */
export function labelBefore(line: string, col: number): string | null {
	const before = line.slice(0, col);
	const match = /^(.*)[:：][\s*_=~"'“«(]*$/.exec(before);
	if (!match) return null;
	const label = normalizeLabel(match[1] ?? '');
	if (label.length === 0 || label.length > MAX_LABEL_LENGTH) return null;
	return label;
}

function lastKeywordIndex(haystack: string, keyword: string): number {
	if (keyword.length === 0) return -1;
	const wholeWord = SPACED_SCRIPT.test(keyword);
	let from = haystack.length;
	while (from >= 0) {
		const index = haystack.lastIndexOf(keyword, from);
		if (index < 0) return -1;
		if (!wholeWord) return index;
		const before = index > 0 ? haystack.charAt(index - 1) : '';
		const after = haystack.charAt(index + keyword.length);
		if (!LETTER_OR_DIGIT.test(before) && !LETTER_OR_DIGIT.test(after)) return index;
		from = index - 1;
	}
	return -1;
}

/** Kind named by the keyword closest to the end of `text`, if any keyword appears. */
export function keywordKind(text: string, keywords: KeywordSets): RefKind | null {
	const haystack = text.toLowerCase();
	const groups: Array<[RefKind, string[]]> = [
		['birth', keywords.birth],
		['death', keywords.death],
	];
	let bestKind: RefKind | null = null;
	let bestEnd = -1;
	for (const [kind, list] of groups) {
		for (const raw of list) {
			const keyword = raw.trim().toLowerCase();
			const index = lastKeywordIndex(haystack, keyword);
			if (index < 0) continue;
			const end = index + keyword.length;
			if (end > bestEnd) {
				bestEnd = end;
				bestKind = kind;
			}
		}
	}
	return bestKind;
}

function isLifespan(from: DayDate, to: DayDate): boolean {
	const days = daysBetween(from, to);
	return days >= MIN_LIFESPAN_DAYS && days <= MAX_LIFESPAN_DAYS;
}

/**
 * Decides what a date link means from its own line.
 *
 * Keywords win: the nearest "born"/"died"-style word between the previous date
 * link and this one. Without a keyword, two date links joined by a dash and
 * 1 to 125 years apart read as a lifespan, so the first is a birth and the
 * second a death. Anything else is a plain event.
 */
export function detectKind(
	line: string,
	target: Span,
	dateSpans: DateSpan[],
	keywords: KeywordSets,
	lifespanPairs: boolean,
): RefKind {
	const sorted = [...dateSpans].sort((a, b) => a.col - b.col);
	const at = sorted.findIndex((span) => span.col === target.col);
	const prev = at > 0 ? sorted[at - 1] : undefined;
	const self = at >= 0 ? sorted[at] : undefined;
	const next = at >= 0 ? sorted[at + 1] : undefined;

	const segmentStart = prev ? prev.endCol : 0;
	const byKeyword = keywordKind(line.slice(segmentStart, target.col), keywords);
	if (byKeyword) return byKeyword;

	if (lifespanPairs && self) {
		if (
			next &&
			RANGE_JOINER.test(line.slice(self.endCol, next.col)) &&
			isLifespan(self.date, next.date)
		) {
			return 'birth';
		}
		if (
			prev &&
			RANGE_JOINER.test(line.slice(prev.endCol, self.col)) &&
			isLifespan(prev.date, self.date)
		) {
			return 'death';
		}
	}
	return 'event';
}

/** Every wikilink on the line that points to a dated note, with its columns. */
export function findDateSpans(
	line: string,
	parseLinkDate: (linkTarget: string) => DayDate | null,
): DateSpan[] {
	const spans: DateSpan[] = [];
	for (const match of line.matchAll(WIKILINK)) {
		const target = (match[1] ?? '').split('|')[0] ?? '';
		const date = parseLinkDate(target);
		if (!date) continue;
		const col = match.index ?? 0;
		spans.push({ col, endCol: col + match[0].length, date });
	}
	return spans;
}

/** True when the line has little text besides its links. */
export function isNavigationLine(line: string): boolean {
	const withoutLinks = line.replace(WIKILINK, ' ');
	const others = withoutLinks.match(LETTERS_AND_DIGITS);
	return (others?.length ?? 0) <= NAV_LINE_MAX_OTHER_CHARS;
}

function stripFrontmatter(lines: string[]): string[] {
	if (lines[0]?.trim() !== '---') return lines;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i]?.trim() === '---') return lines.slice(i + 1);
	}
	return lines;
}

/**
 * Whether a dated note holds anything beyond navigation to neighbouring days.
 * A daily note that only says "yesterday / today / tomorrow" is not worth
 * listing as something written on that day.
 */
export function hasMeaningfulContent(
	lines: string[],
	ownDate: DayDate,
	parseLinkDate: (linkTarget: string) => DayDate | null,
): boolean {
	for (const line of stripFrontmatter(lines)) {
		if (line.trim().length === 0) continue;
		const links = [...line.matchAll(WIKILINK)];
		if (links.length === 0) return true;
		const allNeighbours = links.every((match) => {
			const target = (match[1] ?? '').split('|')[0] ?? '';
			const date = parseLinkDate(target);
			return date !== null && Math.abs(daysBetween(ownDate, date)) <= 1;
		});
		if (!allNeighbours || !isNavigationLine(line)) return true;
	}
	return false;
}
