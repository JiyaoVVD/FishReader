import { hashPath } from '../novel_utils/book_cache';
import * as assert from 'assert';

suite('Book Cache Tests', () => {

	test('hashPath produces consistent hash for same path', () => {
		const path = '/some/path/to/novel.txt';
		const hash1 = hashPath(path);
		const hash2 = hashPath(path);
		assert.strictEqual(hash1, hash2);
	});

	test('hashPath produces different hashes for different paths', () => {
		const hash1 = hashPath('/path/a.txt');
		const hash2 = hashPath('/path/b.txt');
		assert.notStrictEqual(hash1, hash2);
	});

	test('hashPath returns hex string', () => {
		const hash = hashPath('/test/file.txt');
		assert.match(hash, /^[0-9a-f]{32}$/);
	});
});
