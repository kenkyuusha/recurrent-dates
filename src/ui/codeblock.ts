// ABOUTME: The `recurrent-dates` code block: the same list embedded in a note, for
// ABOUTME: example in a daily note template. Follows the note's own date by default.

import { MarkdownRenderChild } from 'obsidian';
import { parseIsoDate } from '../core/dates';
import { dayLabel, strings } from '../core/i18n';
import type RecurrentDatesPlugin from '../main';
import { renderDay } from './render';

export const HOVER_SOURCE_BLOCK = 'recurrent-dates-block';

interface BlockDay {
	month: number;
	day: number;
	/** Set when the block names a full date; otherwise the current year is used. */
	year?: number;
}

/**
 * Reads the block body. The only option is `date:`, as a full `YYYY-MM-DD`
 * date or a bare `MM-DD` day. Returns an error message for anything else.
 */
export function parseBlockSource(source: string): { day: BlockDay | null } | { error: string } {
	let day: BlockDay | null = null;
	for (const raw of source.split('\n')) {
		const line = raw.trim();
		if (line.length === 0) continue;
		const match = /^date\s*:\s*(.+)$/i.exec(line);
		const value = match?.[1]?.trim();
		if (!value) return { error: `Unknown option: ${line}` };
		const full = parseIsoDate(value);
		const bare = parseIsoDate(`2000-${value}`);
		if (full) day = { year: full.year, month: full.month, day: full.day };
		else if (bare) day = { month: bare.month, day: bare.day };
		else return { error: `Not a date: ${value}` };
	}
	return { day };
}

export class RecurrentDatesBlock extends MarkdownRenderChild {
	private renderRun = 0;

	constructor(
		containerEl: HTMLElement,
		private plugin: RecurrentDatesPlugin,
		private source: string,
		private sourcePath: string,
	) {
		super(containerEl);
	}

	onload(): void {
		this.containerEl.addClass('recurrent-dates-block');
		this.plugin.blocks.add(this);
		void this.refresh();
	}

	onunload(): void {
		this.plugin.blocks.delete(this);
	}

	async refresh(): Promise<void> {
		const run = ++this.renderRun;
		const parsed = parseBlockSource(this.source);
		if ('error' in parsed) {
			this.containerEl.empty();
			this.containerEl.createDiv({ cls: 'recurrent-dates-error', text: parsed.error });
			return;
		}

		const today = this.plugin.today();
		const own = this.plugin.indexer.index.ownDateOf(this.sourcePath);
		const target = parsed.day ?? own ?? today;
		const year = parsed.day?.year ?? today.year;

		const model = await this.plugin.buildDay(year, target.month, target.day, this.sourcePath);
		if (run !== this.renderRun) return;

		this.containerEl.empty();
		const lang = this.plugin.lang;
		const title = this.containerEl.createDiv({ cls: 'recurrent-dates-block-title' });
		title.createSpan({ text: strings(lang).viewTitle });
		title.createSpan({ cls: 'recurrent-dates-block-date', text: dayLabel(target.month, target.day, lang) });

		renderDay(this.containerEl.createDiv({ cls: 'recurrent-dates-list' }), model, {
			app: this.plugin.app,
			lang,
			hoverSource: HOVER_SOURCE_BLOCK,
			hoverParent: { hoverPopover: null },
		});
	}
}
