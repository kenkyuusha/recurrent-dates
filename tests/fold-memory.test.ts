// ABOUTME: Contract for remembering which embedded blocks the reader collapsed:
// ABOUTME: only departures from a block's default are kept, and the list stays bounded.

import { describe, expect, it } from 'vitest';
import { blockFoldKey, BlockFoldMemory, MAX_REMEMBERED_BLOCKS } from '../src/core/fold-memory';

describe('BlockFoldMemory', () => {
	it('knows nothing about a block that was never toggled', () => {
		expect(new BlockFoldMemory().get('daily/2026-11-14.md\n')).toBeUndefined();
	});

	it('remembers a state that differs from the block default', () => {
		const memory = new BlockFoldMemory();
		memory.set('a', true, false);
		memory.set('b', false, true);
		expect(memory.get('a')).toBe(true);
		expect(memory.get('b')).toBe(false);
	});

	it('forgets a block once it is back at its default', () => {
		const memory = new BlockFoldMemory();
		memory.set('a', true, false);
		memory.set('a', false, false);
		expect(memory.get('a')).toBeUndefined();
		expect(memory.serialize()).toBe('{}');
	});

	it('survives being saved and loaded', () => {
		const memory = new BlockFoldMemory();
		memory.set('daily/2026-11-14.md\n', true, false);
		memory.set('dashboard.md\ndate: 12-08', false, true);
		const loaded = BlockFoldMemory.parse(memory.serialize());
		expect(loaded.get('daily/2026-11-14.md\n')).toBe(true);
		expect(loaded.get('dashboard.md\ndate: 12-08')).toBe(false);
	});

	it('starts empty from anything it cannot read', () => {
		for (const raw of [null, undefined, '', '{', '[1,2]', '"text"', 42, { a: 'yes' }]) {
			expect(BlockFoldMemory.parse(raw).serialize()).toBe('{}');
		}
	});

	it('also accepts an already parsed object', () => {
		expect(BlockFoldMemory.parse({ a: true, b: false }).get('a')).toBe(true);
	});

	it('keeps only the most recently toggled blocks', () => {
		const memory = new BlockFoldMemory();
		for (let i = 0; i < MAX_REMEMBERED_BLOCKS + 5; i++) memory.set(`note-${i}`, true, false);
		expect(memory.get('note-0')).toBeUndefined();
		expect(memory.get('note-4')).toBeUndefined();
		expect(memory.get('note-5')).toBe(true);
		expect(memory.get(`note-${MAX_REMEMBERED_BLOCKS + 4}`)).toBe(true);
	});

	it('treats a block that is toggled again as recent', () => {
		const memory = new BlockFoldMemory();
		memory.set('old', true, false);
		for (let i = 0; i < MAX_REMEMBERED_BLOCKS - 1; i++) memory.set(`note-${i}`, true, false);
		memory.set('old', true, false);
		memory.set('one-more', true, false);
		expect(memory.get('old')).toBe(true);
		expect(memory.get('note-0')).toBeUndefined();
	});
});

describe('blockFoldKey', () => {
	it('tells blocks apart by note and by what they show', () => {
		expect(blockFoldKey('a.md', '')).toBe(blockFoldKey('a.md', '  \n'));
		expect(blockFoldKey('a.md', '')).not.toBe(blockFoldKey('b.md', ''));
		expect(blockFoldKey('a.md', 'date: 12-08')).not.toBe(blockFoldKey('a.md', ''));
	});
});
