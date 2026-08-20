import * as assert from 'assert';
import {
	applyInlineCompositionUpdate,
	startInlineComposition,
} from '../writing/inline_composition';

suite('Inline Composition Buffer', () => {
	test('applies IME replacement updates without duplicating the final text', () => {
		let state = startInlineComposition('前文');
		state = applyInlineCompositionUpdate(state, {
			text: 'n',
			replacePrevCharCount: 0,
		});
		assert.deepStrictEqual(state, { value: '前文n', cursorOffset: 3 });

		state = applyInlineCompositionUpdate(state, {
			text: 'ni',
			replacePrevCharCount: 1,
		});
		assert.deepStrictEqual(state, { value: '前文ni', cursorOffset: 4 });

		state = applyInlineCompositionUpdate(state, {
			text: '你',
			replacePrevCharCount: 2,
		});
		assert.deepStrictEqual(state, { value: '前文你', cursorOffset: 3 });
	});

	test('supports next-character replacement and composition cursor deltas', () => {
		let state = startInlineComposition('abc');
		state = applyInlineCompositionUpdate(state, {
			text: 'xy',
			replacePrevCharCount: 1,
			positionDelta: -1,
		});
		assert.deepStrictEqual(state, { value: 'abxy', cursorOffset: 3 });

		state = applyInlineCompositionUpdate(state, {
			text: '中',
			replaceNextCharCount: 1,
		});
		assert.deepStrictEqual(state, { value: 'abx中', cursorOffset: 4 });
	});

	test('clamps malformed replacement counts and cursor movement', () => {
		const state = applyInlineCompositionUpdate(startInlineComposition('A'), {
			text: '文',
			replacePrevCharCount: Number.POSITIVE_INFINITY,
			replaceNextCharCount: -10,
			positionDelta: 99,
		});
		assert.deepStrictEqual(state, { value: 'A文', cursorOffset: 2 });
	});
});
