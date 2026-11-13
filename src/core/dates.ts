// ABOUTME: Calendar-day values and arithmetic with no dependency on Obsidian or moment.
// ABOUTME: Everything in src/core is pure so the date rules can be unit tested in Node.

export interface DayDate {
	year: number;
	/** 1-12 */
	month: number;
	/** 1-31 */
	day: number;
}

/** Turns the text of a note name or link target into a date, or null when it is not one. */
export type DateParser = (text: string) => DayDate | null;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidDate(year: number, month: number, day: number): boolean {
	return (
		Number.isInteger(year) &&
		Number.isInteger(month) &&
		Number.isInteger(day) &&
		year >= 1 &&
		year <= 9999 &&
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= daysInMonth(year, month)
	);
}

/** Strict `YYYY-MM-DD`. Rejects impossible days such as 2023-02-29. */
export function parseIsoDate(text: string): DayDate | null {
	const match = ISO_DATE.exec(text);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	return isValidDate(year, month, day) ? { year, month, day } : null;
}

function pad(value: number, width: number): string {
	return String(value).padStart(width, '0');
}

export function toIso(date: DayDate): string {
	return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** The key that groups every year's occurrence of one calendar day: `MM-DD`. */
export function dayKey(month: number, day: number): string {
	return `${pad(month, 2)}-${pad(day, 2)}`;
}

function toEpochDay(date: DayDate): number {
	// setUTCFullYear takes years below 100 literally, unlike Date.UTC.
	const utc = new Date(0);
	utc.setUTCFullYear(date.year, date.month - 1, date.day);
	return Math.round(utc.getTime() / MS_PER_DAY);
}

function fromEpochDay(epochDay: number): DayDate {
	const utc = new Date(epochDay * MS_PER_DAY);
	return {
		year: utc.getUTCFullYear(),
		month: utc.getUTCMonth() + 1,
		day: utc.getUTCDate(),
	};
}

export function addDays(date: DayDate, count: number): DayDate {
	return fromEpochDay(toEpochDay(date) + count);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DayDate, to: DayDate): number {
	return toEpochDay(to) - toEpochDay(from);
}

export function sameDay(a: DayDate, b: DayDate): boolean {
	return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Day keys to look up for a viewed calendar day. February 29 has no slot in
 * common years, so its entries are shown on February 28 of those years.
 */
export function dayKeysFor(year: number, month: number, day: number): string[] {
	const keys = [dayKey(month, day)];
	if (month === 2 && day === 28 && !isLeapYear(year)) keys.push(dayKey(2, 29));
	return keys;
}

/**
 * Reduces a link target to the note name that may be a date:
 * `daily-notes/1894-12-08#heading` becomes `1894-12-08`.
 */
export function linkTargetToDateText(link: string): string {
	let text = link;
	const subpath = text.indexOf('#');
	if (subpath >= 0) text = text.slice(0, subpath);
	const slash = text.lastIndexOf('/');
	if (slash >= 0) text = text.slice(slash + 1);
	text = text.trim();
	if (text.toLowerCase().endsWith('.md')) text = text.slice(0, -3);
	return text;
}
