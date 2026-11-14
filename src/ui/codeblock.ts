// ABOUTME: The `recurrent-dates` code block: the same list embedded in a note, for
// ABOUTME: example in a daily note template. Its header collapses and expands it.

import { MarkdownRenderChild, setIcon } from 'obsidian';
import { parseBlockSource, type BlockOptions } from '../core/block-options';
import { blockFoldKey } from '../core/fold-memory';
import { dayLabel, strings } from '../core/i18n';
import type RecurrentDatesPlugin from '../main';
import { renderDay } from './render';

export const HOVER_SOURCE_BLOCK = 'recurrent-dates-block';

export class RecurrentDatesBlock extends MarkdownRenderChild {
	/** Null when the block's options could not be read and an error is shown instead. */
	private options: BlockOptions | null = null;
	private collapsed = false;
	private headerEl: HTMLElement | null = null;
	private arrowEl: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private dateEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
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
		const root = this.containerEl;
		root.addClass('recurrent-dates-block');

		const parsed = parseBlockSource(this.source);
		if ('error' in parsed) {
			root.createDiv({ cls: 'recurrent-dates-error', text: parsed.error });
			return;
		}
		this.options = parsed;
		this.collapsed = this.plugin.foldMemory.get(this.foldKey) ?? this.defaultCollapsed;

		this.buildFrame();
		this.plugin.blocks.add(this);
		void this.refresh();
	}

	onunload(): void {
		this.plugin.blocks.delete(this);
	}

	private get foldKey(): string {
		return blockFoldKey(this.sourcePath, this.source);
	}

	private get defaultCollapsed(): boolean {
		return this.options?.collapsed ?? false;
	}

	/** Builds the parts that stay put: the clickable header and the list container. */
	private buildFrame(): void {
		const root = this.containerEl;
		// `interactive-child` tells Obsidian's editor that a click here is meant
		// for this element and must not start editing the surrounding block.
		const header = root.createDiv({ cls: ['recurrent-dates-block-header', 'interactive-child'] });
		header.setAttr('role', 'button');
		header.setAttr('tabindex', '0');

		// Obsidian's own fold arrow, the one used for folders and backlinks:
		// its size, color and rotation come from the app's `collapse-icon` styles.
		this.arrowEl = header.createDiv({ cls: ['recurrent-dates-collapse', 'collapse-icon'] });
		setIcon(this.arrowEl, 'right-triangle');

		header.createSpan({ cls: 'recurrent-dates-block-title', text: strings(this.plugin.lang).viewTitle });
		this.countEl = header.createSpan({ cls: 'recurrent-dates-block-count' });
		this.dateEl = header.createSpan({ cls: 'recurrent-dates-block-date' });

		header.addEventListener('click', (event) => {
			event.preventDefault();
			this.toggle();
		});
		header.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			this.toggle();
		});

		this.headerEl = header;
		this.listEl = root.createDiv({ cls: 'recurrent-dates-list' });
		this.applyCollapsed();
	}

	private toggle(): void {
		this.collapsed = !this.collapsed;
		this.applyCollapsed();
		this.plugin.rememberFold(this.foldKey, this.collapsed, this.defaultCollapsed, this);
	}

	/** Follows another copy of the same block, such as the same note in a second pane. */
	syncFold(key: string, collapsed: boolean): void {
		if (key !== this.foldKey || collapsed === this.collapsed) return;
		this.collapsed = collapsed;
		this.applyCollapsed();
	}

	private applyCollapsed(): void {
		this.containerEl.toggleClass('recurrent-dates-collapsed', this.collapsed);
		this.arrowEl?.toggleClass('is-collapsed', this.collapsed);
		this.headerEl?.setAttr('aria-expanded', String(!this.collapsed));
	}

	async refresh(): Promise<void> {
		if (!this.options || !this.listEl) return;
		const run = ++this.renderRun;

		const today = this.plugin.today();
		const own = this.plugin.indexer.index.ownDateOf(this.sourcePath);
		const target = this.options.day ?? own ?? today;
		const year = this.options.day?.year ?? today.year;

		const model = await this.plugin.buildDay(year, target.month, target.day, this.sourcePath);
		// A newer refresh started while this one was reading notes.
		if (run !== this.renderRun) return;

		const lang = this.plugin.lang;
		this.dateEl?.setText(dayLabel(target.month, target.day, lang));
		// The count stays visible when the list is folded away.
		this.countEl?.setText(String(model.total));

		renderDay(this.listEl, model, {
			app: this.plugin.app,
			lang,
			hoverSource: HOVER_SOURCE_BLOCK,
			hoverParent: { hoverPopover: null },
		});
	}
}
