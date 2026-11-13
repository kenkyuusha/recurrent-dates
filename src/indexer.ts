// ABOUTME: Bridge between Obsidian and the core index. Reads link positions from
// ABOUTME: the metadata cache (no file reads) and builds the model for one day.

import { type App, type CachedMetadata, moment, type TFile } from 'obsidian';
import { DateIndex, type DateRef } from './core/date-index';
import {
	dayKeysFor,
	isValidDate,
	linkTargetToDateText,
	parseIsoDate,
	type DateParser,
	type DayDate,
} from './core/dates';
import { buildDayModel, isInFolders, type CoreSettings, type DayModel } from './core/model';
import { DEFAULT_DATE_FORMAT } from './settings';

export function makeDateParser(format: string): DateParser {
	if (format === DEFAULT_DATE_FORMAT) return parseIsoDate;
	return (text) => {
		const parsed = moment(text, format, true);
		if (!parsed.isValid()) return null;
		const year = parsed.year();
		const month = parsed.month() + 1;
		const day = parsed.date();
		return isValidDate(year, month, day) ? { year, month, day } : null;
	};
}

export class VaultIndexer {
	readonly index = new DateIndex();
	private parseName: DateParser;

	constructor(
		private app: App,
		format: string,
	) {
		this.parseName = makeDateParser(format);
	}

	/** Parses a link target such as `daily-notes/1894-12-08#evening`. */
	readonly parseLinkDate = (linkTarget: string): DayDate | null =>
		this.parseName(linkTargetToDateText(linkTarget));

	setFormat(format: string): void {
		this.parseName = makeDateParser(format);
		this.rebuild();
	}

	rebuild(): void {
		this.index.clear();
		for (const file of this.app.vault.getMarkdownFiles()) this.indexFile(file);
	}

	indexFile(file: TFile, cache?: CachedMetadata | null): void {
		const meta = cache ?? this.app.metadataCache.getFileCache(file);
		const refs: DateRef[] = [];

		for (const link of meta?.links ?? []) {
			const date = this.parseLinkDate(link.link);
			if (!date) continue;
			const { start, end } = link.position;
			refs.push({
				path: file.path,
				date,
				line: start.line,
				col: start.col,
				endCol: end.line === start.line ? end.col : -1,
				display: link.displayText ?? link.link,
			});
		}

		for (const link of meta?.frontmatterLinks ?? []) {
			const date = this.parseLinkDate(link.link);
			if (!date) continue;
			refs.push({
				path: file.path,
				date,
				line: -1,
				col: -1,
				endCol: -1,
				display: link.displayText ?? link.link,
				key: link.key,
			});
		}

		this.index.setFile(file.path, refs, this.parseName(file.basename));
	}

	removePath(path: string): void {
		this.index.removeFile(path);
	}

	/**
	 * Builds the list for one calendar day. Only now is note text read, and
	 * only for notes that have something on this day.
	 */
	async buildDay(
		year: number,
		month: number,
		day: number,
		settings: CoreSettings,
		hostPath?: string,
	): Promise<DayModel> {
		const keys = dayKeysFor(year, month, day);
		const refs = this.index.refsOn(keys);
		const notes = this.index.notesOn(keys);

		const wanted = new Set<string>();
		for (const ref of refs) if (ref.line >= 0) wanted.add(ref.path);
		if (settings.showDatedNotes) for (const note of notes) wanted.add(note.path);

		const content = new Map<string, string[]>();
		await Promise.all(
			[...wanted]
				.filter((path) => !isInFolders(path, settings.excludedFolders))
				.map(async (path) => {
					const file = this.app.vault.getFileByPath(path);
					if (!file) return;
					try {
						content.set(path, (await this.app.vault.cachedRead(file)).split(/\r?\n/));
					} catch {
						// Unreadable note: its links are still listed, without a snippet.
					}
				}),
		);

		return buildDayModel({
			year,
			month,
			day,
			refs,
			notes,
			lines: (path) => content.get(path) ?? null,
			ownDateOf: (path) => this.index.ownDateOf(path),
			parseLinkDate: this.parseLinkDate,
			settings,
			hostPath,
		});
	}
}
