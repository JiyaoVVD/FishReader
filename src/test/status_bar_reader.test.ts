import { StatusBarReader } from '../status_bar_reader';
import { BookContentTree } from '../novel_utils/book_content_tree';
import * as assert from 'assert';

function makeBook(chapterCount: number, linesPerChapter: number): BookContentTree {
	const children: BookContentTree[] = [];
	for (let i = 0; i < chapterCount; i++) {
		const lines: string[] = [];
		for (let j = 0; j < linesPerChapter; j++) {
			lines.push(`Chapter${i}_Line${j}_content`);
		}
		children.push({ title: `Chapter ${i}`, type: 'chapter', content: lines });
	}
	return { title: 'TestBook', type: 'book', children };
}

suite('StatusBarReader Position Tests', () => {

	test('getPosition returns initial position', () => {
		const book = makeBook(3, 5);
		const reader = new StatusBarReader(book);
		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 0);
		assert.strictEqual(pos.lineIndex, 0);
		assert.strictEqual(pos.contentIndex, 0);
	});

	test('getPosition reflects navigation', () => {
		const book = makeBook(3, 5);
		const reader = new StatusBarReader(book);
		reader.showLength = 100;
		reader.nextChapter();
		reader.nextLine();
		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 1);
		assert.strictEqual(pos.lineIndex, 1);
	});

	test('setPosition restores valid position', () => {
		const book = makeBook(3, 5);
		const reader = new StatusBarReader(book);
		reader.setPosition({ chapterIndex: 2, lineIndex: 3, contentIndex: 0 });
		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 2);
		assert.strictEqual(pos.lineIndex, 3);
		assert.strictEqual(pos.contentIndex, 0);
	});

	test('setPosition clamps chapter to last when out of range', () => {
		const book = makeBook(3, 5);
		const reader = new StatusBarReader(book);
		reader.setPosition({ chapterIndex: 100, lineIndex: 2, contentIndex: 5 });
		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 2); // last chapter
		assert.strictEqual(pos.lineIndex, 0); // reset
		assert.strictEqual(pos.contentIndex, 0); // reset
	});

	test('setPosition clamps lineIndex to last line', () => {
		const book = makeBook(2, 3);
		const reader = new StatusBarReader(book);
		reader.setPosition({ chapterIndex: 0, lineIndex: 100, contentIndex: 0 });
		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 0);
		assert.strictEqual(pos.lineIndex, 2); // last line (0-indexed)
	});

	test('setPosition does nothing when no bookData', () => {
		const reader = new StatusBarReader();
		reader.setPosition({ chapterIndex: 1, lineIndex: 1, contentIndex: 0 });
		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 0);
		assert.strictEqual(pos.lineIndex, 0);
		assert.strictEqual(pos.contentIndex, 0);
	});

	test('setPosition does nothing when book has no children', () => {
		const emptyBook: BookContentTree = { title: 'Empty', type: 'book', children: [] };
		const reader = new StatusBarReader(emptyBook);
		reader.setPosition({ chapterIndex: 0, lineIndex: 0, contentIndex: 0 });
		const pos = reader.getPosition();
		assert.strictEqual(pos.chapterIndex, 0);
	});

	test('getPosition roundtrips through setPosition', () => {
		const book = makeBook(5, 10);
		const reader = new StatusBarReader(book);
		reader.setChapter(3);
		reader.nextLine();
		reader.nextLine();
		const saved = reader.getPosition();

		const reader2 = new StatusBarReader(book);
		reader2.setPosition(saved);
		const restored = reader2.getPosition();
		assert.deepStrictEqual(restored, saved);
	});
});
