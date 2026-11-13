// ABOUTME: The plugin's settings: stored shape, defaults, conversion into the
// ABOUTME: form the core logic uses, and the settings tab.

import {
	type App,
	normalizePath,
	PluginSettingTab,
	Setting,
	type SettingDefinition,
	type SettingDefinitionItem,
} from 'obsidian';
import { normalizeLabel } from './core/classify';
import type { CoreSettings } from './core/model';
import type YearsAgoPlugin from './main';

export interface YearsAgoSettings {
	/** Moment.js pattern of date link targets and daily note names. */
	dateFormat: string;
	/** Comma or newline separated labels, as typed. */
	ignoredLabels: string;
	/** One folder per line, as typed. */
	excludedFolders: string;
	birthKeywords: string;
	deathKeywords: string;
	lifespanPairs: boolean;
	showDatedNotes: boolean;
	showFuture: boolean;
	newestFirst: boolean;
}

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

export const DEFAULT_SETTINGS: YearsAgoSettings = {
	dateFormat: DEFAULT_DATE_FORMAT,
	ignoredLabels:
		'created, date created, created date, date added, added, saved, updated, modified, date modified',
	excludedFolders: '',
	birthKeywords: 'born, birth, birthday, родился, родилась, рождение, рождения, 生まれ, 誕生',
	deathKeywords: 'died, death, умер, умерла, скончался, скончалась, смерть, смерти, погиб, погибла, 死去, 逝去',
	lifespanPairs: true,
	showDatedNotes: true,
	showFuture: false,
	newestFirst: false,
};

function splitList(text: string): string[] {
	return text
		.split(/[,\n]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

/** The date format to index with; an emptied field falls back to the default. */
export function effectiveDateFormat(settings: YearsAgoSettings): string {
	return settings.dateFormat.trim() || DEFAULT_DATE_FORMAT;
}

export function toCoreSettings(settings: YearsAgoSettings): CoreSettings {
	return {
		ignoredLabels: splitList(settings.ignoredLabels).map(normalizeLabel),
		excludedFolders: settings.excludedFolders
			.split('\n')
			.map((folder) => folder.trim())
			.filter((folder) => folder.length > 0)
			.map((folder) => normalizePath(folder)),
		keywords: {
			birth: splitList(settings.birthKeywords),
			death: splitList(settings.deathKeywords),
		},
		lifespanPairs: settings.lifespanPairs,
		showDatedNotes: settings.showDatedNotes,
		showFuture: settings.showFuture,
		newestFirst: settings.newestFirst,
	};
}

type SettingKey = keyof YearsAgoSettings;

interface Field {
	key: SettingKey;
	kind: 'text' | 'textarea' | 'toggle';
	name: string;
	desc: string;
}

interface Section {
	heading?: string;
	fields: Field[];
}

// One description of the settings, rendered two ways: declaratively on
// Obsidian 1.13 and later (which also makes them searchable), and with
// display() on older versions.
const SECTIONS: Section[] = [
	{
		fields: [
			{
				key: 'dateFormat',
				kind: 'text',
				name: 'Date format',
				desc: 'How dates are written in link targets and daily note names, as a Moment.js pattern. Links to notes named this way are treated as dates.',
			},
			{
				key: 'showDatedNotes',
				kind: 'toggle',
				name: 'Show daily notes from other years',
				desc: 'List notes named after this day in other years, unless they only link to the days around them.',
			},
			{
				key: 'showFuture',
				kind: 'toggle',
				name: 'Show future years',
				desc: 'Include dates that lie in years after the current one.',
			},
			{
				key: 'newestFirst',
				kind: 'toggle',
				name: 'Newest year first',
				desc: 'List the most recent year at the top instead of the oldest.',
			},
		],
	},
	{
		heading: 'Filtering',
		fields: [
			{
				key: 'ignoredLabels',
				kind: 'textarea',
				name: 'Ignored labels',
				desc: 'A line written as "label: [[date]]" is skipped when its label is listed here. Separate labels with commas or new lines.',
			},
			{
				key: 'excludedFolders',
				kind: 'textarea',
				name: 'Excluded folders',
				desc: 'Notes in these folders are left out. One folder per line.',
			},
		],
	},
	{
		heading: 'Births and deaths',
		fields: [
			{
				key: 'lifespanPairs',
				kind: 'toggle',
				name: 'Read date pairs as lifespans',
				desc: 'Treat two dates joined by a dash as a birth and a death when they are 1 to 125 years apart.',
			},
			{
				key: 'birthKeywords',
				kind: 'textarea',
				name: 'Birth keywords',
				desc: 'A date is marked as a birth when one of these words comes before it on the same line.',
			},
			{
				key: 'deathKeywords',
				kind: 'textarea',
				name: 'Death keywords',
				desc: 'A date is marked as a death when one of these words comes before it on the same line.',
			},
		],
	},
];

function isSettingKey(key: string): key is SettingKey {
	return key in DEFAULT_SETTINGS;
}

function toDefinition(field: Field): SettingDefinition {
	const base = { name: field.name, desc: field.desc };
	if (field.kind === 'toggle') return { ...base, control: { type: 'toggle', key: field.key } };
	if (field.kind === 'textarea') return { ...base, control: { type: 'textarea', key: field.key, rows: 4 } };
	return { ...base, control: { type: 'text', key: field.key, placeholder: DEFAULT_DATE_FORMAT } };
}

export class YearsAgoSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: YearsAgoPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return SECTIONS.flatMap((section): SettingDefinitionItem[] => {
			const items = section.fields.map(toDefinition);
			return section.heading ? [{ type: 'group', heading: section.heading, items }] : items;
		});
	}

	getControlValue(key: string): unknown {
		return isSettingKey(key) ? this.plugin.settings[key] : undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await this.store(key, value);
	}

	/** Fallback for Obsidian versions before 1.13, which do not read the definitions. */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		for (const section of SECTIONS) {
			if (section.heading) new Setting(containerEl).setName(section.heading).setHeading();
			for (const field of section.fields) this.renderField(field);
		}
	}

	private renderField(field: Field): void {
		const setting = new Setting(this.containerEl).setName(field.name).setDesc(field.desc);
		const current = this.plugin.settings[field.key];
		if (field.kind === 'toggle') {
			setting.addToggle((toggle) =>
				toggle.setValue(current === true).onChange((value) => void this.store(field.key, value)),
			);
		} else if (field.kind === 'textarea') {
			setting.setClass('years-ago-setting-wide').addTextArea((area) =>
				area.setValue(String(current)).onChange((value) => void this.store(field.key, value)),
			);
		} else {
			setting.addText((text) =>
				text
					.setPlaceholder(DEFAULT_DATE_FORMAT)
					.setValue(String(current))
					.onChange((value) => void this.store(field.key, value)),
			);
		}
	}

	private async store(key: string, value: unknown): Promise<void> {
		if (!isSettingKey(key)) return;
		// Only accept a value of the type the setting already has.
		if (typeof value !== typeof DEFAULT_SETTINGS[key]) return;
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
	}
}
