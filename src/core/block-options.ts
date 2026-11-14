// ABOUTME: Reads the options a reader can write inside a `recurrent-dates` code
// ABOUTME: block: which day it shows and whether it starts collapsed.

import { parseIsoDate } from './dates';

export interface BlockDay {
	month: number;
	day: number;
	/** Set when the block names a full date; otherwise the current year is used. */
	year?: number;
}

export interface BlockOptions {
	/** The day to show, or null for the host note's own date (else today). */
	day: BlockDay | null;
	/** Whether the block starts collapsed. Absent when the block does not say. */
	collapsed?: boolean;
}

export interface BlockOptionsError {
	error: string;
}

function parseDay(value: string): BlockDay | null {
	const full = parseIsoDate(value);
	if (full) return { year: full.year, month: full.month, day: full.day };
	// A bare MM-DD is checked against a leap year so 02-29 is accepted.
	const bare = /^\d{2}-\d{2}$/.test(value) ? parseIsoDate(`2000-${value}`) : null;
	return bare ? { month: bare.month, day: bare.day } : null;
}

/**
 * Parses the block body, one `key: value` option per line:
 * `date: 12-08` or `date: 1894-12-08`, and `collapsed: true` or `false`.
 */
export function parseBlockSource(source: string): BlockOptions | BlockOptionsError {
	const options: BlockOptions = { day: null };
	for (const raw of source.split('\n')) {
		const line = raw.trim();
		if (line.length === 0) continue;
		const match = /^([a-z]+)\s*:\s*(.+)$/i.exec(line);
		const key = match?.[1]?.toLowerCase();
		const value = match?.[2]?.trim() ?? '';

		if (key === 'date') {
			const day = parseDay(value);
			if (!day) return { error: `Not a date: ${value}` };
			options.day = day;
		} else if (key === 'collapsed') {
			const flag = value.toLowerCase();
			if (flag !== 'true' && flag !== 'false') {
				return { error: `Use true or false for collapsed, not: ${value}` };
			}
			options.collapsed = flag === 'true';
		} else {
			return { error: `Unknown option: ${line}` };
		}
	}
	return options;
}
