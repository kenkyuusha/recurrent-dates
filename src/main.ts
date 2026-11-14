// ABOUTME: Plugin lifecycle: wires the index to vault events and registers the
// ABOUTME: sidebar view, the code block, the commands and the settings tab.

import { debounce, getLanguage, Plugin, TFile } from 'obsidian';
import { CODE_BLOCK_LANGUAGE } from './core/constants';
import { toIso, type DayDate } from './core/dates';
import { BlockFoldMemory } from './core/fold-memory';
import { resolveLang, strings, type Lang } from './core/i18n';
import type { DayModel } from './core/model';
import { VaultIndexer } from './indexer';
import {
	DEFAULT_SETTINGS,
	effectiveDateFormat,
	toCoreSettings,
	RecurrentDatesSettingTab,
	type RecurrentDatesSettings,
} from './settings';
import { HOVER_SOURCE_BLOCK, RecurrentDatesBlock } from './ui/codeblock';
import { VIEW_TYPE_RECURRENT_DATES, RecurrentDatesView } from './ui/view';

const REFRESH_DELAY_MS = 400;
const DAY_CHECK_INTERVAL_MS = 60_000;
/** Per-device flag: the panel is added to the sidebar once, then left to the user. */
const VIEW_ADDED_KEY = 'recurrent-dates-view-added';
/** Per-device record of which embedded blocks the reader collapsed or expanded. */
const FOLD_MEMORY_KEY = 'recurrent-dates-block-folds';

export default class RecurrentDatesPlugin extends Plugin {
	settings: RecurrentDatesSettings = { ...DEFAULT_SETTINGS };
	indexer!: VaultIndexer;
	lang: Lang = 'en';
	/** Code blocks currently on screen, refreshed together with the panel. */
	readonly blocks = new Set<RecurrentDatesBlock>();
	/** Fold state of embedded blocks. Kept per device, so a phone and a desktop can differ. */
	foldMemory = new BlockFoldMemory();

	private indexedFormat = DEFAULT_SETTINGS.dateFormat;
	private lastDay = '';
	private started = false;

	private readonly requestRefresh = debounce(() => this.refreshAll(), REFRESH_DELAY_MS, true);

	async onload(): Promise<void> {
		await this.loadSettings();
		this.lang = resolveLang(getLanguage());
		this.indexedFormat = effectiveDateFormat(this.settings);
		this.indexer = new VaultIndexer(this.app, this.indexedFormat);
		this.foldMemory = BlockFoldMemory.parse(this.app.loadLocalStorage(FOLD_MEMORY_KEY));
		const title = strings(this.lang).viewTitle;

		this.registerView(VIEW_TYPE_RECURRENT_DATES, (leaf) => new RecurrentDatesView(leaf, this));
		this.registerHoverLinkSource(VIEW_TYPE_RECURRENT_DATES, { display: `${title} (panel)`, defaultMod: true });
		this.registerHoverLinkSource(HOVER_SOURCE_BLOCK, { display: `${title} (block)`, defaultMod: true });

		this.registerMarkdownCodeBlockProcessor(CODE_BLOCK_LANGUAGE, (source, el, ctx) => {
			ctx.addChild(new RecurrentDatesBlock(el, this, source, ctx.sourcePath));
		});

		this.addRibbonIcon('calendar-clock', title, () => void this.activateView());
		this.addCommand({
			id: 'open-view',
			name: 'Open on this day',
			callback: () => void this.activateView(),
		});
		this.addSettingTab(new RecurrentDatesSettingTab(this.app, this));

		// The metadata cache is only complete once the workspace has loaded.
		this.app.workspace.onLayoutReady(() => this.start());
	}

	private start(): void {
		this.indexer.rebuild();
		this.lastDay = toIso(this.today());
		this.started = true;

		this.registerEvent(
			this.app.metadataCache.on('changed', (file, _data, cache) => {
				this.indexer.indexFile(file, cache);
				this.requestRefresh();
			}),
		);
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				this.indexer.removePath(file.path);
				this.requestRefresh();
			}),
		);
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				this.indexer.removePath(oldPath);
				if (file instanceof TFile && file.extension === 'md') this.indexer.indexFile(file);
				this.requestRefresh();
			}),
		);
		this.registerInterval(window.setInterval(() => this.checkDayChange(), DAY_CHECK_INTERVAL_MS));

		this.refreshAll();
		void this.addViewOnce();
	}

	today(): DayDate {
		const now = new Date();
		return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
	}

	buildDay(year: number, month: number, day: number, hostPath?: string): Promise<DayModel> {
		return this.indexer.buildDay(year, month, day, toCoreSettings(this.settings), hostPath);
	}

	/** Stores a block's fold state and applies it to other copies of the same block. */
	rememberFold(key: string, collapsed: boolean, defaultCollapsed: boolean, origin: RecurrentDatesBlock): void {
		this.foldMemory.set(key, collapsed, defaultCollapsed);
		this.app.saveLocalStorage(FOLD_MEMORY_KEY, this.foldMemory.serialize());
		for (const block of this.blocks) {
			if (block !== origin) block.syncFold(key, collapsed);
		}
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_RECURRENT_DATES)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_RECURRENT_DATES, active: true });
		}
		if (leaf) await workspace.revealLeaf(leaf);
	}

	/** Adds the panel to the right sidebar the first time the plugin runs on a device. */
	private async addViewOnce(): Promise<void> {
		if (this.app.loadLocalStorage(VIEW_ADDED_KEY)) return;
		this.app.saveLocalStorage(VIEW_ADDED_KEY, '1');
		if (this.app.workspace.getLeavesOfType(VIEW_TYPE_RECURRENT_DATES).length > 0) return;
		await this.app.workspace.getRightLeaf(false)?.setViewState({ type: VIEW_TYPE_RECURRENT_DATES, active: false });
	}

	private refreshAll(): void {
		if (!this.started) return;
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_RECURRENT_DATES)) {
			// Sidebar tabs that were never shown are deferred and have no view yet.
			if (leaf.view instanceof RecurrentDatesView) void leaf.view.refresh();
		}
		for (const block of this.blocks) void block.refresh();
	}

	private checkDayChange(): void {
		const current = toIso(this.today());
		if (current === this.lastDay) return;
		this.lastDay = current;
		this.refreshAll();
	}

	private applySettings(): void {
		const format = effectiveDateFormat(this.settings);
		if (format !== this.indexedFormat) {
			this.indexedFormat = format;
			if (this.started) this.indexer.setFormat(format);
		}
		this.requestRefresh();
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<RecurrentDatesSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.applySettings();
	}

	/** Settings arrived from another device through sync. */
	async onExternalSettingsChange(): Promise<void> {
		await this.loadSettings();
		this.applySettings();
	}
}
