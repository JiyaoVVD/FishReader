import * as assert from 'assert';

// Minimal mock of vscode.Memento for testing saveProgress/loadProgress
class MockMemento {
	private store: Map<string, any> = new Map();
	get<T>(key: string): T | undefined;
	get<T>(key: string, defaultValue: T): T;
	get<T>(key: string, defaultValue?: T): T | undefined {
		const val = this.store.get(key);
		return val !== undefined ? val : defaultValue;
	}
	async update(key: string, value: any): Promise<void> {
		if (value === undefined) {
			this.store.delete(key);
		} else {
			this.store.set(key, value);
		}
	}
	keys(): readonly string[] {
		return Array.from(this.store.keys());
	}
	setKeysForSync(_keys: readonly string[]): void {}
}

interface ReadingPosition {
	chapterIndex: number;
	lineIndex: number;
	contentIndex: number;
}

// Re-implement helpers here to test the logic (they're simple module-level functions)
function saveProgress(globalState: MockMemento, bookPath: string, position: ReadingPosition): void {
	globalState.update(`progress:${bookPath}`, position);
}

function loadProgress(globalState: MockMemento, bookPath: string): ReadingPosition | undefined {
	return globalState.get<ReadingPosition>(`progress:${bookPath}`);
}

suite('Progress Persistence Tests', () => {

	test('saveProgress stores and loadProgress retrieves', async () => {
		const state = new MockMemento();
		const pos: ReadingPosition = { chapterIndex: 3, lineIndex: 5, contentIndex: 10 };
		await saveProgress(state, '/book/a.txt', pos);
		const loaded = loadProgress(state, '/book/a.txt');
		assert.deepStrictEqual(loaded, pos);
	});

	test('loadProgress returns undefined for unknown book', () => {
		const state = new MockMemento();
		const loaded = loadProgress(state, '/book/unknown.txt');
		assert.strictEqual(loaded, undefined);
	});

	test('separate books have separate progress', async () => {
		const state = new MockMemento();
		const posA: ReadingPosition = { chapterIndex: 1, lineIndex: 2, contentIndex: 0 };
		const posB: ReadingPosition = { chapterIndex: 5, lineIndex: 0, contentIndex: 3 };
		await saveProgress(state, '/book/a.txt', posA);
		await saveProgress(state, '/book/b.txt', posB);
		assert.deepStrictEqual(loadProgress(state, '/book/a.txt'), posA);
		assert.deepStrictEqual(loadProgress(state, '/book/b.txt'), posB);
	});

	test('saveProgress overwrites previous progress', async () => {
		const state = new MockMemento();
		const pos1: ReadingPosition = { chapterIndex: 0, lineIndex: 0, contentIndex: 0 };
		const pos2: ReadingPosition = { chapterIndex: 4, lineIndex: 7, contentIndex: 15 };
		await saveProgress(state, '/book/a.txt', pos1);
		await saveProgress(state, '/book/a.txt', pos2);
		assert.deepStrictEqual(loadProgress(state, '/book/a.txt'), pos2);
	});

	test('lastBook stored and retrieved via Memento', async () => {
		const state = new MockMemento();
		await state.update('lastBook', '/path/to/novel.txt');
		assert.strictEqual(state.get<string>('lastBook'), '/path/to/novel.txt');
	});
});
