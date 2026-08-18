import { StatusBarReader } from '../status_bar_reader';
import { BookContentTree } from '../novel_utils/book_content_tree';
import * as assert from 'assert';

// Mock Memento
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

function saveProgress(globalState: MockMemento, bookPath: string, position: ReadingPosition): void {
	globalState.update(`progress:${bookPath}`, position);
}

function loadProgress(globalState: MockMemento, bookPath: string): ReadingPosition | undefined {
	return globalState.get<ReadingPosition>(`progress:${bookPath}`);
}

function makeBook(chapterCount: number, linesPerChapter: number): BookContentTree {
	const children: BookContentTree[] = [];
	for (let i = 0; i < chapterCount; i++) {
		const lines: string[] = [];
		for (let j = 0; j < linesPerChapter; j++) {
			lines.push(`Ch${i}_Line${j}_some_content_here`);
		}
		children.push({ title: `Chapter ${i}`, type: 'chapter', content: lines });
	}
	return { title: 'TestBook', type: 'book', children };
}

suite('Startup Restore Integration Tests', () => {

	test('full restore: save progress → new reader → setPosition restores exactly', async () => {
		const state = new MockMemento();
		const book = makeBook(5, 10);
		const bookPath = '/test/novel.txt';

		// Simulate reading session
		const reader1 = new StatusBarReader(book);
		reader1.setChapter(3);
		reader1.nextLine();
		reader1.nextLine();
		const pos = reader1.getPosition();
		await saveProgress(state, bookPath, pos);
		await state.update('lastBook', bookPath);

		// Simulate restart: new reader, same book data
		const lastBook = state.get<string>('lastBook');
		assert.strictEqual(lastBook, bookPath);

		const reader2 = new StatusBarReader(book);
		const savedProgress = loadProgress(state, bookPath);
		assert.ok(savedProgress);
		reader2.setPosition(savedProgress!);

		assert.deepStrictEqual(reader2.getPosition(), pos);
		assert.strictEqual(reader2.currentChapterTitle, 'Chapter 3');
	});

	test('restore with no saved progress: reader stays at beginning', () => {
		const state = new MockMemento();
		const book = makeBook(3, 5);

		const savedProgress = loadProgress(state, '/unknown/book.txt');
		const reader = new StatusBarReader(book);
		if (savedProgress) {
			reader.setPosition(savedProgress);
		}

		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 0);
		assert.strictEqual(pos.lineIndex, 0);
		assert.strictEqual(pos.contentIndex, 0);
	});

	test('restore with no lastBook: no book loaded', () => {
		const state = new MockMemento();
		const lastBook = state.get<string>('lastBook');
		assert.strictEqual(lastBook, undefined);
	});

	test('restore with out-of-range progress clamps correctly', async () => {
		const state = new MockMemento();
		const bookPath = '/test/novel.txt';

		// Save progress with high indices
		await saveProgress(state, bookPath, { chapterIndex: 100, lineIndex: 50, contentIndex: 999 });

		// Restore with a smaller book
		const smallBook = makeBook(2, 3);
		const reader = new StatusBarReader(smallBook);
		const saved = loadProgress(state, bookPath)!;
		reader.setPosition(saved);

		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 1); // clamped to last chapter
		assert.strictEqual(pos.lineIndex, 0); // reset due to chapter clamp
	});
});
