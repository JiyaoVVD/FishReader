import * as assert from 'assert';
import {
	countDraftCharacters,
	countGraphemes,
	deleteLastGraphemes,
	formatPreview,
	splitGraphemes,
	takeLastGraphemes,
} from '../writing/grapheme_utils';

suite('Writing Grapheme Utilities', () => {
	test('counts Chinese and composed emoji as graphemes', () => {
		assert.strictEqual(countGraphemes('中文'), 2);
		assert.strictEqual(countGraphemes('👨‍👩‍👧‍👦'), 1);
		assert.strictEqual(countGraphemes('e\u0301'), 1);
	});

	test('takes and deletes whole graphemes', () => {
		assert.strictEqual(takeLastGraphemes('甲乙👨‍👩‍👧‍👦', 2), '乙👨‍👩‍👧‍👦');
		assert.strictEqual(deleteLastGraphemes('甲乙👨‍👩‍👧‍👦', 1), '甲乙');
		assert.deepStrictEqual(splitGraphemes('甲e\u0301'), ['甲', 'e\u0301']);
	});

	test('formats newlines and excludes them from draft character count', () => {
		assert.strictEqual(formatPreview('甲\n乙', 3), '甲↵乙');
		assert.strictEqual(countDraftCharacters('甲\n乙'), 2);
	});
});
