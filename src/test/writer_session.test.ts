import * as assert from 'assert';
import { WriterSession } from '../writing/writer_session';
import { LoadedDraft } from '../writing/writing_types';

function makeDraft(content = '', revision = 0): LoadedDraft {
	return {
		metadata: {
			id: 'draft-1',
			title: '测试草稿',
			createdAt: 1,
			updatedAt: 1,
			charCount: 0,
			revision,
		},
		content,
	};
}

suite('Writer Session', () => {
	test('keeps real input separate from decoy output', () => {
		const session = new WriterSession(makeDraft(), 'typescript');
		assert.strictEqual(session.replaceCurrentSegment('今天下雨', 1), true);
		const snapshot = session.getSnapshot();
		assert.strictEqual(snapshot.currentSegment, '今天下雨');
		assert.strictEqual(snapshot.charCount, 4);
		assert.strictEqual(snapshot.decoyText, '// T');
		assert.ok(!snapshot.decoyText.includes('今天'));
	});

	test('ignores duplicate composition messages by sequence', () => {
		const session = new WriterSession(makeDraft(), 'python');
		assert.strictEqual(session.replaceCurrentSegment('中文', 10), true);
		assert.strictEqual(session.replaceCurrentSegment('中文中文', 10), false);
		assert.strictEqual(session.getSnapshot().currentSegment, '中文');
	});

	test('deletion retracts the deterministic decoy prefix', () => {
		const session = new WriterSession(makeDraft(), 'lua');
		session.replaceCurrentSegment('甲乙丙', 1);
		const longer = session.getSnapshot().decoyText;
		session.replaceCurrentSegment('甲乙', 2);
		const shorter = session.getSnapshot().decoyText;
		assert.strictEqual(longer.length, 3);
		assert.strictEqual(shorter.length, 2);
	});

	test('submits current segment and rotates the template', () => {
		const session = new WriterSession(makeDraft(), 'typescript');
		session.submitCurrentSegment('第一段', 1);
		const snapshot = session.getSnapshot();
		assert.strictEqual(snapshot.committedContent, '第一段\n');
		assert.strictEqual(snapshot.currentSegment, '');
		assert.strictEqual(snapshot.charCount, 3);
	});

	test('ignores a duplicate submitted sequence', () => {
		const session = new WriterSession(makeDraft(), 'generic');
		assert.strictEqual(session.submitCurrentSegment('第一段', 1), true);
		assert.strictEqual(session.submitCurrentSegment('第一段', 1), false);
		assert.strictEqual(session.getSnapshot().fullContent, '第一段\n');
	});

	test('multi-line paste commits complete lines and retains final segment', () => {
		const session = new WriterSession(makeDraft('开头\n'), 'markdown');
		session.replaceCurrentSegment('甲\n乙\n丙', 1);
		const snapshot = session.getSnapshot();
		assert.strictEqual(snapshot.committedContent, '开头\n甲\n乙\n');
		assert.strictEqual(snapshot.currentSegment, '丙');
		assert.strictEqual(snapshot.fullContent, '开头\n甲\n乙\n丙');
	});

	test('restores the final unterminated line as current segment', () => {
		const session = new WriterSession(makeDraft('第一段\n未提交'), 'generic');
		const snapshot = session.getSnapshot();
		assert.strictEqual(snapshot.committedContent, '第一段\n');
		assert.strictEqual(snapshot.currentSegment, '未提交');
	});

	test('stale save acknowledgement cannot claim the newest text is saved', () => {
		const session = new WriterSession(makeDraft(), 'generic');
		session.replaceCurrentSegment('甲', 1);
		const first = session.getSnapshot();
		session.markSaving(first.localRevision);
		session.replaceCurrentSegment('甲乙', 2);
		session.markSaved(first.localRevision, 1);
		assert.strictEqual(session.getSnapshot().saveState, 'idle');
		assert.strictEqual(session.getSnapshot().baseRevision, 1);
	});
});
