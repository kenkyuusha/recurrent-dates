// ABOUTME: Turns the Markdown line around a date link into short plain text,
// ABOUTME: split into parts so the matched date can be highlighted.

import type { Span } from './classify';

export interface SnippetPart {
	text: string;
	highlight: boolean;
}

export interface SnippetLimits {
	before: number;
	after: number;
}

export const DEFAULT_SNIPPET_LIMITS: SnippetLimits = { before: 80, after: 120 };

const ELLIPSIS = '…';
const LINE_LEAD = /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+(?:\[.\]\s+)?)?(?:#{1,6}\s+)?/;

function linkDisplay(target: string, alias: string | undefined): string {
	if (alias !== undefined && alias.trim().length > 0) return alias.trim();
	const hash = target.indexOf('#');
	const pathPart = hash >= 0 ? target.slice(0, hash) : target;
	const subpath = hash >= 0 ? target.slice(hash + 1) : '';
	if (pathPart.trim().length === 0) return subpath.replace(/^\^/, '').trim();
	const slash = pathPart.lastIndexOf('/');
	return (slash >= 0 ? pathPart.slice(slash + 1) : pathPart).trim();
}

/** Replaces Markdown syntax inside a line fragment with the text a reader sees. */
export function cleanInline(text: string): string {
	return text
		.replace(/!?\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]/g, (_all, target: string, alias?: string) =>
			linkDisplay(target, alias),
		)
		.replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
		.replace(/<\/?[a-zA-Z][^>\n]*>/g, ' ')
		.replace(/\*\*|__|==|~~|`/g, '')
		.replace(/\s+/g, ' ');
}

function truncateEnd(text: string, limit: number): string {
	if (text.length <= limit) return text;
	let cut = text.slice(0, limit);
	const space = cut.lastIndexOf(' ');
	if (space >= limit - 15) cut = cut.slice(0, space);
	return cut.trimEnd() + ELLIPSIS;
}

function truncateStart(text: string, limit: number): string {
	if (text.length <= limit) return text;
	let cut = text.slice(text.length - limit);
	const space = cut.indexOf(' ');
	if (space >= 0 && space <= 15) cut = cut.slice(space + 1);
	return ELLIPSIS + cut.trimStart();
}

/**
 * Builds the snippet for one line. With a valid span the result is
 * `[before, link, after]` and the link part is flagged for highlighting;
 * otherwise it is the whole line as a single plain part.
 */
export function buildSnippet(
	line: string,
	span: Span | null,
	limits: SnippetLimits = DEFAULT_SNIPPET_LIMITS,
): SnippetPart[] {
	const valid =
		span !== null && span.col >= 0 && span.endCol > span.col && span.endCol <= line.length;
	if (!valid) {
		const whole = cleanInline(line.replace(LINE_LEAD, '')).trim();
		const text = truncateEnd(whole, limits.before + limits.after);
		return text.length > 0 ? [{ text, highlight: false }] : [];
	}

	const before = cleanInline(line.slice(0, span.col).replace(LINE_LEAD, '')).trimStart();
	const link = cleanInline(line.slice(span.col, span.endCol)).trim();
	const after = cleanInline(line.slice(span.endCol)).trimEnd();

	const parts: SnippetPart[] = [];
	if (before.length > 0) parts.push({ text: truncateStart(before, limits.before), highlight: false });
	if (link.length > 0) parts.push({ text: link, highlight: true });
	if (after.length > 0) parts.push({ text: truncateEnd(after, limits.after), highlight: false });
	return parts;
}
