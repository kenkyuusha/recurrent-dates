// ABOUTME: Remembers, per device, which embedded blocks the reader collapsed or
// ABOUTME: expanded. Keeps only departures from each block's default, newest last.

/** Oldest entries are dropped beyond this many, so the stored list cannot grow forever. */
export const MAX_REMEMBERED_BLOCKS = 300;

/** Identifies a block by its note and its options, so two notes fold independently. */
export function blockFoldKey(notePath: string, blockSource: string): string {
	return `${notePath}\n${blockSource.trim()}`;
}

export class BlockFoldMemory {
	// Map keeps insertion order, which doubles as "least recently toggled first".
	private entries = new Map<string, boolean>();

	/** Builds the memory from what was stored; anything unreadable gives an empty one. */
	static parse(raw: unknown): BlockFoldMemory {
		const memory = new BlockFoldMemory();
		let data: unknown = raw;
		if (typeof raw === 'string') {
			try {
				data = JSON.parse(raw);
			} catch {
				return memory;
			}
		}
		if (typeof data !== 'object' || data === null || Array.isArray(data)) return memory;
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'boolean') memory.entries.set(key, value);
		}
		return memory;
	}

	/** The remembered state, or undefined when the block should use its default. */
	get(key: string): boolean | undefined {
		return this.entries.get(key);
	}

	/** Records a toggle. A block that is back at its default no longer needs an entry. */
	set(key: string, collapsed: boolean, defaultCollapsed: boolean): void {
		this.entries.delete(key);
		if (collapsed === defaultCollapsed) return;
		this.entries.set(key, collapsed);
		while (this.entries.size > MAX_REMEMBERED_BLOCKS) {
			const oldest = this.entries.keys().next();
			if (oldest.done) break;
			this.entries.delete(oldest.value);
		}
	}

	serialize(): string {
		return JSON.stringify(Object.fromEntries(this.entries));
	}
}
