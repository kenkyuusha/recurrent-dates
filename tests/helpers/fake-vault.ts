// ABOUTME: Test stand-in for Obsidian's metadata cache: finds wikilinks in plain
// ABOUTME: note text and feeds them to the index the way the real indexer does.

import { DateIndex, type DateRef } from '../../src/core/date-index';
import { linkTargetToDateText, parseIsoDate, type DayDate } from '../../src/core/dates';
import { noteTitle, type CoreSettings } from '../../src/core/model';

const WIKILINK = /\[\[([^\]\n]+?)\]\]/g;

export function parseLinkDate(linkTarget: string): DayDate | null {
	return parseIsoDate(linkTargetToDateText(linkTarget));
}

export function scanNote(path: string, text: string): DateRef[] {
	const refs: DateRef[] = [];
	text.split(/\r?\n/).forEach((line, lineNumber) => {
		for (const match of line.matchAll(WIKILINK)) {
			const inner = match[1] ?? '';
			const [target = '', alias] = inner.split('|');
			const date = parseLinkDate(target);
			if (!date) continue;
			const col = match.index ?? 0;
			refs.push({
				path,
				date,
				line: lineNumber,
				col,
				endCol: col + match[0].length,
				display: alias ?? target,
			});
		}
	});
	return refs;
}

export interface FakeVault {
	index: DateIndex;
	lines: (path: string) => string[] | null;
	ownDateOf: (path: string) => DayDate | null;
}

export function fakeVault(notes: Record<string, string>): FakeVault {
	const index = new DateIndex();
	for (const [path, text] of Object.entries(notes)) {
		index.setFile(path, scanNote(path, text), parseIsoDate(noteTitle(path)));
	}
	return {
		index,
		lines: (path) => (path in notes ? (notes[path] ?? '').split(/\r?\n/) : null),
		ownDateOf: (path) => index.ownDateOf(path),
	};
}

export const TEST_SETTINGS: CoreSettings = {
	ignoredLabels: ['created', 'date added', 'saved'],
	excludedFolders: [],
	keywords: {
		birth: ['born', 'birth', 'birthday', 'родился', 'родилась', 'день рождения', '生まれ'],
		death: ['died', 'death', 'умер', 'умерла', '死去'],
	},
	lifespanPairs: true,
	showDatedNotes: true,
	showFuture: false,
	newestFirst: false,
};
