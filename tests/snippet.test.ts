// ABOUTME: Contract for the short plain-text snippet shown under each entry,
// ABOUTME: including which part is highlighted as the matched date.

import { describe, expect, it } from 'vitest';
import { buildSnippet, cleanInline } from '../src/core/snippet';

function spanOf(line: string, link: string) {
	const col = line.indexOf(link);
	return { col, endCol: col + link.length };
}

describe('cleanInline', () => {
	it('shows links the way a reader sees them', () => {
		expect(cleanInline('in [[trieste]], [[italy|Italy]]')).toBe('in trieste, Italy');
		expect(cleanInline('see [[folder/note#part]] and [[#Heading]]')).toBe('see note and Heading');
		expect(cleanInline('[the paper](https://example.com/p.pdf) says')).toBe('the paper says');
	});

	it('drops emphasis markers and collapses whitespace', () => {
		expect(cleanInline('**bold** ==mark== ~~gone~~ `code`   end')).toBe('bold mark gone code end');
	});
});

describe('buildSnippet', () => {
	it('splits the line around the link and highlights the link', () => {
		const line = '[[1821-05-16]] - [[1894-12-08]] ';
		expect(buildSnippet(line, spanOf(line, '[[1894-12-08]]'))).toEqual([
			{ text: '1821-05-16 - ', highlight: false },
			{ text: '1894-12-08', highlight: true },
		]);
	});

	it('strips list markers, checkboxes, quotes and heading marks from the start', () => {
		const line = '    - [ ] born: [[1907-04-25]] in Riga';
		expect(buildSnippet(line, spanOf(line, '[[1907-04-25]]'))).toEqual([
			{ text: 'born: ', highlight: false },
			{ text: '1907-04-25', highlight: true },
			{ text: ' in Riga', highlight: false },
		]);
		const heading = '## [[2024-06-01]] launch';
		expect(buildSnippet(heading, spanOf(heading, '[[2024-06-01]]'))[0]).toEqual({
			text: '2024-06-01',
			highlight: true,
		});
	});

	it('keeps tags, which are not headings', () => {
		const line = '#biography born on [[1868-02-11]]';
		expect(buildSnippet(line, spanOf(line, '[[1868-02-11]]'))[0]?.text).toBe('#biography born on ');
	});

	it('uses the alias as the highlighted text', () => {
		const line = 'published [[1902-10-14|in October 1902]]';
		expect(buildSnippet(line, spanOf(line, '[[1902-10-14|in October 1902]]'))[1]).toEqual({
			text: 'in October 1902',
			highlight: true,
		});
	});

	it('truncates long text on both sides of the link', () => {
		const line = `${'before '.repeat(40)}[[2020-01-01]]${' after'.repeat(60)}`;
		const parts = buildSnippet(line, spanOf(line, '[[2020-01-01]]'), { before: 30, after: 40 });
		expect(parts[0]?.text.startsWith('…')).toBe(true);
		expect(parts[0]?.text.length).toBeLessThanOrEqual(31);
		expect(parts[1]).toEqual({ text: '2020-01-01', highlight: true });
		expect(parts[2]?.text.endsWith('…')).toBe(true);
		expect(parts[2]?.text.length).toBeLessThanOrEqual(41);
	});

	it('falls back to the whole line when the position is unusable', () => {
		expect(buildSnippet('- some **text** here', null)).toEqual([{ text: 'some text here', highlight: false }]);
		expect(buildSnippet('short', { col: 2, endCol: 99 })).toEqual([{ text: 'short', highlight: false }]);
		expect(buildSnippet('   ', null)).toEqual([]);
	});
});
