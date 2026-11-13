// ABOUTME: Builds what is shown for one calendar day: date links and dated notes,
// ABOUTME: filtered, classified and grouped by year. Pure; note text is passed in.

import {
	detectKind,
	findDateSpans,
	hasMeaningfulContent,
	isNavigationLine,
	keywordKind,
	labelBefore,
	normalizeLabel,
	type DateSpan,
	type KeywordSets,
	type RefKind,
} from './classify';
import type { DatedNote, DateRef } from './date-index';
import { daysBetween, toIso, type DayDate } from './dates';
import { buildSnippet, type SnippetPart } from './snippet';

export type EntryKind = RefKind | 'note';

export interface CoreSettings {
	/** Normalized labels; a `label: [[date]]` line with one of these is skipped. */
	ignoredLabels: string[];
	/** Vault folders whose notes are left out, without trailing slashes. */
	excludedFolders: string[];
	keywords: KeywordSets;
	/** Read `[[date]] - [[date]]` as birth and death. */
	lifespanPairs: boolean;
	/** List notes named after the day itself (daily notes from other years). */
	showDatedNotes: boolean;
	/** Include dates in years after the viewed year. */
	showFuture: boolean;
	newestFirst: boolean;
}

export interface Entry {
	path: string;
	/** Note name without folder or extension. */
	title: string;
	date: DayDate;
	kind: EntryKind;
	/** 0-based line to jump to, or -1 for the top of the note. */
	line: number;
	snippet: SnippetPart[];
	/** How many further lines of the same note link to the same date. */
	extraMentions: number;
}

export interface YearGroup {
	year: number;
	/** Viewed year minus this year: 0 is the viewed year, negative is the future. */
	yearsAgo: number;
	entries: Entry[];
}

export interface DayModel {
	year: number;
	month: number;
	day: number;
	groups: YearGroup[];
	total: number;
}

export interface DayModelInput {
	/** Reference year for "N years ago", usually the current year. */
	year: number;
	month: number;
	day: number;
	refs: DateRef[];
	notes: DatedNote[];
	/** Text of a note split into lines, or null when it could not be read. */
	lines: (path: string) => string[] | null;
	/** The date a note is named after, if any. */
	ownDateOf: (path: string) => DayDate | null;
	/** Parses a link target such as `folder/1894-12-08#h` into a date. */
	parseLinkDate: (linkTarget: string) => DayDate | null;
	settings: CoreSettings;
}

const KIND_ORDER: Record<EntryKind, number> = { birth: 0, death: 1, event: 2, note: 3 };

export function noteTitle(path: string): string {
	const slash = path.lastIndexOf('/');
	const name = slash >= 0 ? path.slice(slash + 1) : path;
	return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name;
}

export function isInFolders(path: string, folders: string[]): boolean {
	return folders.some((folder) => folder.length > 0 && path.startsWith(folder + '/'));
}

function spanForRef(ref: DateRef, spans: DateSpan[]): DateSpan | null {
	const exact = spans.find((span) => span.col === ref.col);
	if (exact) return exact;
	const overlapping = spans.find((span) => span.col < ref.endCol && span.endCol > ref.col);
	if (overlapping) return overlapping;
	return spans.find((span) => toIso(span.date) === toIso(ref.date)) ?? null;
}

interface Candidate {
	ref: DateRef;
	kind: RefKind;
	snippet: SnippetPart[];
}

function evaluateRef(ref: DateRef, input: DayModelInput): Candidate | null {
	const { settings } = input;
	const ignored = new Set(settings.ignoredLabels);

	if (ref.line < 0) {
		// Property link: there is no line to read, only the property name.
		const key = ref.key ?? '';
		if (ignored.has(normalizeLabel(key))) return null;
		const text = key.length > 0 ? `${key}: ` : '';
		return {
			ref,
			kind: keywordKind(key, settings.keywords) ?? 'event',
			snippet: [
				...(text.length > 0 ? [{ text, highlight: false }] : []),
				{ text: ref.display, highlight: true },
			],
		};
	}

	const line = input.lines(ref.path)?.[ref.line];
	if (line === undefined) {
		return { ref, kind: 'event', snippet: [{ text: ref.display, highlight: true }] };
	}

	const spans = findDateSpans(line, input.parseLinkDate);
	const span = spanForRef(ref, spans) ?? { col: ref.col, endCol: ref.endCol, date: ref.date };

	const ownDate = input.ownDateOf(ref.path);
	const linksNeighbour = ownDate !== null && Math.abs(daysBetween(ownDate, ref.date)) <= 1;
	if (linksNeighbour && isNavigationLine(line)) return null;

	const label = labelBefore(line, span.col);
	if (label !== null && ignored.has(label)) return null;

	return {
		ref,
		kind: detectKind(line, span, spans, settings.keywords, settings.lifespanPairs),
		snippet: buildSnippet(line, span),
	};
}

export function buildDayModel(input: DayModelInput): DayModel {
	const { settings } = input;
	const byYear = new Map<number, Entry[]>();
	const push = (entry: Entry) => {
		const list = byYear.get(entry.date.year);
		if (list) list.push(entry);
		else byYear.set(entry.date.year, [entry]);
	};
	const allowed = (path: string, date: DayDate) =>
		!isInFolders(path, settings.excludedFolders) &&
		(settings.showFuture || date.year <= input.year);

	// One entry per note and date: the first line that survives the filters,
	// with a count of the other lines that mention the same date.
	const perNoteDate = new Map<string, { entry: Entry; lines: Set<number> }>();
	const ordered = [...input.refs].sort(
		(a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.col - b.col,
	);
	for (const ref of ordered) {
		if (!allowed(ref.path, ref.date)) continue;
		const candidate = evaluateRef(ref, input);
		if (!candidate) continue;
		const id = `${ref.path}\n${toIso(ref.date)}`;
		const existing = perNoteDate.get(id);
		if (existing) {
			existing.lines.add(ref.line);
			existing.entry.extraMentions = existing.lines.size - 1;
			continue;
		}
		const entry: Entry = {
			path: ref.path,
			title: noteTitle(ref.path),
			date: ref.date,
			kind: candidate.kind,
			line: ref.line,
			snippet: candidate.snippet,
			extraMentions: 0,
		};
		perNoteDate.set(id, { entry, lines: new Set([ref.line]) });
		push(entry);
	}

	if (settings.showDatedNotes) {
		for (const note of input.notes) {
			if (!allowed(note.path, note.date)) continue;
			// The note for the viewed day itself is where the reader already is.
			if (note.date.year === input.year) continue;
			const lines = input.lines(note.path);
			if (!lines || !hasMeaningfulContent(lines, note.date, input.parseLinkDate)) continue;
			push({
				path: note.path,
				title: noteTitle(note.path),
				date: note.date,
				kind: 'note',
				line: -1,
				snippet: [],
				extraMentions: 0,
			});
		}
	}

	const groups: YearGroup[] = [...byYear.entries()].map(([year, entries]) => ({
		year,
		yearsAgo: input.year - year,
		entries: entries.sort(
			(a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title),
		),
	}));
	groups.sort((a, b) => (settings.newestFirst ? b.year - a.year : a.year - b.year));

	return {
		year: input.year,
		month: input.month,
		day: input.day,
		groups,
		total: groups.reduce((sum, group) => sum + group.entries.length, 0),
	};
}
