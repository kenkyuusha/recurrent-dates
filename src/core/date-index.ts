// ABOUTME: In-memory index of every date link in the vault, grouped by calendar day.
// ABOUTME: Holds positions only; note text is read later, just for the day being shown.

import { dayKey, type DayDate } from './dates';

/** One link from a note to a dated note, for example `[[1894-12-08]]`. */
export interface DateRef {
	/** Vault path of the note that contains the link. */
	path: string;
	/** The date the link points to. */
	date: DayDate;
	/** 0-based line of the link, or -1 when the link sits in frontmatter. */
	line: number;
	/** 0-based column where the link starts, or -1 when unknown. */
	col: number;
	/** 0-based column just past the link, or -1 when unknown. */
	endCol: number;
	/** Text shown for the link (alias or target). */
	display: string;
	/** Frontmatter property that holds the link, when it is a property link. */
	key?: string;
}

/** A note whose own name is a date, typically a daily note. */
export interface DatedNote {
	path: string;
	date: DayDate;
}

export class DateIndex {
	private refsByFile = new Map<string, DateRef[]>();
	private ownDateByFile = new Map<string, DayDate>();
	private filesByDay = new Map<string, Set<string>>();

	/** Replaces everything known about one note. */
	setFile(path: string, refs: DateRef[], ownDate: DayDate | null): void {
		this.removeFile(path);
		if (refs.length > 0) {
			this.refsByFile.set(path, refs);
			for (const ref of refs) this.link(dayKey(ref.date.month, ref.date.day), path);
		}
		if (ownDate) {
			this.ownDateByFile.set(path, ownDate);
			this.link(dayKey(ownDate.month, ownDate.day), path);
		}
	}

	removeFile(path: string): void {
		const refs = this.refsByFile.get(path) ?? [];
		for (const ref of refs) this.unlink(dayKey(ref.date.month, ref.date.day), path);
		const ownDate = this.ownDateByFile.get(path);
		if (ownDate) this.unlink(dayKey(ownDate.month, ownDate.day), path);
		this.refsByFile.delete(path);
		this.ownDateByFile.delete(path);
	}

	clear(): void {
		this.refsByFile.clear();
		this.ownDateByFile.clear();
		this.filesByDay.clear();
	}

	/** Every date link that falls on one of the given `MM-DD` keys. */
	refsOn(keys: string[]): DateRef[] {
		const wanted = new Set(keys);
		const found: DateRef[] = [];
		for (const path of this.pathsOn(keys)) {
			for (const ref of this.refsByFile.get(path) ?? []) {
				if (wanted.has(dayKey(ref.date.month, ref.date.day))) found.push(ref);
			}
		}
		return found;
	}

	/** Every dated note whose own date falls on one of the given `MM-DD` keys. */
	notesOn(keys: string[]): DatedNote[] {
		const wanted = new Set(keys);
		const found: DatedNote[] = [];
		for (const path of this.pathsOn(keys)) {
			const date = this.ownDateByFile.get(path);
			if (date && wanted.has(dayKey(date.month, date.day))) found.push({ path, date });
		}
		return found;
	}

	ownDateOf(path: string): DayDate | null {
		return this.ownDateByFile.get(path) ?? null;
	}

	stats(): { notesWithLinks: number; links: number; datedNotes: number; days: number } {
		let links = 0;
		for (const refs of this.refsByFile.values()) links += refs.length;
		return {
			notesWithLinks: this.refsByFile.size,
			links,
			datedNotes: this.ownDateByFile.size,
			days: this.filesByDay.size,
		};
	}

	private pathsOn(keys: string[]): Set<string> {
		const paths = new Set<string>();
		for (const key of keys) {
			for (const path of this.filesByDay.get(key) ?? []) paths.add(path);
		}
		return paths;
	}

	private link(key: string, path: string): void {
		let paths = this.filesByDay.get(key);
		if (!paths) {
			paths = new Set();
			this.filesByDay.set(key, paths);
		}
		paths.add(path);
	}

	private unlink(key: string, path: string): void {
		const paths = this.filesByDay.get(key);
		if (!paths) return;
		paths.delete(path);
		if (paths.size === 0) this.filesByDay.delete(key);
	}
}
