// ABOUTME: Draws a day's list (year groups and their entries) into an element.
// ABOUTME: Shared by the sidebar view and the code block so both look the same.

import { type App, type HoverParent, Keymap, type PaneType } from 'obsidian';
import { ageLabel, type Lang, strings } from '../core/i18n';
import type { DayModel, Entry } from '../core/model';

export interface RenderContext {
	app: App;
	lang: Lang;
	/** Identifies this plugin to the Page preview core plugin. */
	hoverSource: string;
	hoverParent: HoverParent;
	/** Called after a note was opened from the list. */
	onOpened?: () => void;
}

async function openEntry(entry: Entry, ctx: RenderContext, pane: PaneType | boolean): Promise<void> {
	const file = ctx.app.vault.getFileByPath(entry.path);
	if (!file) return;
	const leaf = ctx.app.workspace.getLeaf(pane);
	await leaf.openFile(file, entry.line >= 0 ? { eState: { line: entry.line } } : undefined);
	ctx.onOpened?.();
}

function renderEntry(parent: HTMLElement, entry: Entry, ctx: RenderContext): void {
	const text = strings(ctx.lang);
	const el = parent.createDiv({ cls: ['years-ago-entry', `years-ago-kind-${entry.kind}`] });
	el.setAttr('role', 'link');
	el.setAttr('tabindex', '0');

	const titleEl = el.createDiv({ cls: 'years-ago-entry-title' });
	titleEl.createSpan({ cls: 'years-ago-entry-name', text: entry.title });
	const kindText = text.kinds[entry.kind];
	if (kindText.length > 0) titleEl.createSpan({ cls: 'years-ago-kind', text: kindText });

	if (entry.snippet.length > 0 || entry.extraMentions > 0) {
		const snippetEl = el.createDiv({ cls: 'years-ago-entry-snippet' });
		for (const part of entry.snippet) {
			snippetEl.createSpan({ cls: part.highlight ? 'years-ago-match' : undefined, text: part.text });
		}
		if (entry.extraMentions > 0) {
			snippetEl.createSpan({ cls: 'years-ago-more', text: text.moreMentions(entry.extraMentions) });
		}
	}

	el.addEventListener('click', (event) => {
		void openEntry(entry, ctx, Keymap.isModEvent(event));
	});
	el.addEventListener('auxclick', (event) => {
		if (event.button === 1) void openEntry(entry, ctx, 'tab');
	});
	el.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') void openEntry(entry, ctx, Keymap.isModEvent(event));
	});
	el.addEventListener('mouseover', (event) => {
		ctx.app.workspace.trigger('hover-link', {
			event,
			source: ctx.hoverSource,
			hoverParent: ctx.hoverParent,
			targetEl: el,
			linktext: entry.path,
			sourcePath: '',
			state: entry.line >= 0 ? { scroll: entry.line } : undefined,
		});
	});
}

export function renderDay(container: HTMLElement, model: DayModel, ctx: RenderContext): void {
	container.empty();
	if (model.total === 0) {
		container.createDiv({ cls: 'years-ago-empty', text: strings(ctx.lang).empty });
		return;
	}
	for (const group of model.groups) {
		const groupEl = container.createDiv({ cls: 'years-ago-group' });
		const header = groupEl.createDiv({ cls: 'years-ago-group-header' });
		header.createSpan({ cls: 'years-ago-age', text: ageLabel(group.yearsAgo, ctx.lang) });
		header.createSpan({ cls: 'years-ago-year', text: String(group.year) });
		for (const entry of group.entries) renderEntry(groupEl, entry, ctx);
	}
}
