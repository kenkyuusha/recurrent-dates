// ABOUTME: The "On this day" sidebar panel: shows today's list and lets the
// ABOUTME: reader step to neighbouring days. Works the same on desktop and mobile.

import { type HoverParent, type HoverPopover, ItemView, Platform, setIcon, type WorkspaceLeaf } from 'obsidian';
import { addDays, sameDay, type DayDate } from '../core/dates';
import { dayLabel, strings } from '../core/i18n';
import type RecurrentDatesPlugin from '../main';
import { renderDay } from './render';

export const VIEW_TYPE_RECURRENT_DATES = 'recurrent-dates-view';

export class RecurrentDatesView extends ItemView implements HoverParent {
	/** Set by the Page preview core plugin while a preview from this panel is open. */
	hoverPopover: HoverPopover | null = null;
	/** The day being browsed, or null to follow today. */
	private selected: DayDate | null = null;
	private dateEl: HTMLElement | null = null;
	private todayEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private renderRun = 0;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: RecurrentDatesPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_RECURRENT_DATES;
	}

	getDisplayText(): string {
		return strings(this.plugin.lang).viewTitle;
	}

	getIcon(): string {
		return 'calendar-clock';
	}

	async onOpen(): Promise<void> {
		const text = strings(this.plugin.lang);
		const root = this.contentEl;
		root.empty();
		root.addClass('recurrent-dates-view');

		const header = root.createDiv({ cls: 'recurrent-dates-header' });
		const previous = header.createDiv({ cls: 'clickable-icon', attr: { 'aria-label': text.previousDay } });
		setIcon(previous, 'chevron-left');
		previous.addEventListener('click', () => this.shift(-1));

		this.dateEl = header.createDiv({ cls: 'recurrent-dates-date' });

		const next = header.createDiv({ cls: 'clickable-icon', attr: { 'aria-label': text.nextDay } });
		setIcon(next, 'chevron-right');
		next.addEventListener('click', () => this.shift(1));

		this.todayEl = root.createDiv({ cls: 'recurrent-dates-today', text: text.today });
		this.todayEl.addEventListener('click', () => {
			this.selected = null;
			void this.refresh();
		});

		this.listEl = root.createDiv({ cls: 'recurrent-dates-list' });
		await this.refresh();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private shown(): DayDate {
		return this.selected ?? this.plugin.today();
	}

	private shift(days: number): void {
		const target = addDays(this.shown(), days);
		this.selected = sameDay(target, this.plugin.today()) ? null : target;
		void this.refresh();
	}

	async refresh(): Promise<void> {
		if (!this.listEl || !this.dateEl || !this.todayEl) return;
		const run = ++this.renderRun;
		const date = this.shown();

		this.dateEl.setText(dayLabel(date.month, date.day, this.plugin.lang));
		this.todayEl.toggleClass('is-hidden', this.selected === null);

		const model = await this.plugin.buildDay(date.year, date.month, date.day);
		// A newer refresh started while this one was reading notes.
		if (run !== this.renderRun || !this.listEl) return;

		renderDay(this.listEl, model, {
			app: this.app,
			lang: this.plugin.lang,
			hoverSource: VIEW_TYPE_RECURRENT_DATES,
			hoverParent: this,
			onOpened: () => {
				// On phones the panel lives in a drawer that covers the note.
				if (Platform.isMobile) this.app.workspace.rightSplit.collapse();
			},
		});
	}
}
