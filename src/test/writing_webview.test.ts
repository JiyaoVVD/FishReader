import * as assert from 'assert';
import { buildWritingRenderModel, parseWebviewMessage } from '../writing/writing_webview';
import { WriterSnapshot } from '../writing/writing_types';

function snapshot(): WriterSnapshot {
	return {
		draftId: 'draft-1',
		title: '测试',
		languageId: 'typescript',
		committedContent: '第一行\n',
		currentSegment: '真实内容',
		fullContent: '第一行\n真实内容',
		decoyText: '// T',
		charCount: 8,
		localRevision: 2,
		baseRevision: 1,
		saveState: 'saving',
		lastInputSequence: 3,
	};
}

suite('Writing Webview Model', () => {
	test('render model exposes only the current input value and decoy state needed by the control', () => {
		assert.deepStrictEqual(buildWritingRenderModel(snapshot()), {
			currentSegment: '真实内容',
			decoyText: '// T',
			saveState: 'saving',
		});
	});

	test('accepts valid input and composition messages', () => {
		assert.deepStrictEqual(parseWebviewMessage({ type: 'input', value: '甲', sequence: 1 }), {
			type: 'input', value: '甲', sequence: 1,
		});
		assert.deepStrictEqual(parseWebviewMessage({ type: 'compositionEnd', value: '中文', sequence: 2 }), {
			type: 'compositionEnd', value: '中文', sequence: 2,
		});
		assert.deepStrictEqual(parseWebviewMessage({ type: 'compositionStart' }), { type: 'compositionStart' });
	});

	test('rejects malformed or unsafe messages', () => {
		assert.strictEqual(parseWebviewMessage({ type: 'input', value: 42, sequence: 1 }), undefined);
		assert.strictEqual(parseWebviewMessage({ type: 'input', value: '甲', sequence: -1 }), undefined);
		assert.strictEqual(parseWebviewMessage({ type: 'unknown' }), undefined);
		assert.strictEqual(parseWebviewMessage(null), undefined);
	});
});
