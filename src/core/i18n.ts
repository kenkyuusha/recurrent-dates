// ABOUTME: Interface text in English and Russian, plus the "N years ago" wording
// ABOUTME: with correct plural forms. Unknown languages fall back to English.

import type { EntryKind } from './model';

export type Lang = 'en' | 'ru';

interface Strings {
	viewTitle: string;
	today: string;
	previousDay: string;
	nextDay: string;
	empty: string;
	loading: string;
	thisYear: string;
	kinds: Record<EntryKind, string>;
	moreMentions: (count: number) => string;
	yearsAgo: (count: number) => string;
	inYears: (count: number) => string;
}

function russianYears(count: number): string {
	const rule = new Intl.PluralRules('ru').select(count);
	if (rule === 'one') return 'год';
	if (rule === 'few') return 'года';
	return 'лет';
}

const EN: Strings = {
	viewTitle: 'On this day',
	today: 'Today',
	previousDay: 'Previous day',
	nextDay: 'Next day',
	empty: 'Nothing in your notes is linked to this day yet.',
	loading: 'Loading…',
	thisYear: 'this year',
	kinds: { birth: 'born', death: 'died', event: '', note: 'daily note' },
	moreMentions: (count) => `+${count} more`,
	yearsAgo: (count) => (count === 1 ? '1 year ago' : `${count} years ago`),
	inYears: (count) => (count === 1 ? 'in 1 year' : `in ${count} years`),
};

const RU: Strings = {
	viewTitle: 'В этот день',
	today: 'Сегодня',
	previousDay: 'Предыдущий день',
	nextDay: 'Следующий день',
	empty: 'В заметках пока нет ссылок на этот день.',
	loading: 'Загрузка…',
	thisYear: 'в этом году',
	kinds: { birth: 'рождение', death: 'смерть', event: '', note: 'заметка дня' },
	moreMentions: (count) => `ещё ${count}`,
	yearsAgo: (count) => `${count} ${russianYears(count)} назад`,
	inYears: (count) => `через ${count} ${russianYears(count)}`,
};

const TABLE: Record<Lang, Strings> = { en: EN, ru: RU };

/** Maps an app language code such as `ru` or `en-GB` to a supported language. */
export function resolveLang(code: string | null | undefined): Lang {
	return (code ?? '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function strings(lang: Lang): Strings {
	return TABLE[lang];
}

/** "132 years ago", "this year", or "in 3 years" for dates still ahead. */
export function ageLabel(yearsAgo: number, lang: Lang): string {
	const text = strings(lang);
	if (yearsAgo === 0) return text.thisYear;
	return yearsAgo > 0 ? text.yearsAgo(yearsAgo) : text.inYears(-yearsAgo);
}

/** "8 December" / "8 декабря": the day without a year, in the reader's language. */
export function dayLabel(month: number, day: number, lang: Lang): string {
	// 2000 is a leap year, so February 29 formats correctly.
	const date = new Date(Date.UTC(2000, month - 1, day));
	return new Intl.DateTimeFormat(lang === 'ru' ? 'ru' : 'en-GB', {
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC',
	}).format(date);
}
