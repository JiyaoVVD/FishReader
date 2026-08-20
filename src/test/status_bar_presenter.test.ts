import * as assert from 'assert';
import * as vscode from 'vscode';
import { StatusBarPresenter, formatWritingStatus } from '../writing/status_bar_presenter';
import { WriterSnapshot } from '../writing/writing_types';

class FakeStatusBarItem {
	text = '';
	tooltip: string | vscode.MarkdownString | undefined;
	command: string | vscode.Command | undefined;
	visible = false;
	disposed = false;

	show(): void { this.visible = true; }
	hide(): void { this.visible = false; }
	dispose(): void { this.disposed = true; }
}

function makeSnapshot(saveState: WriterSnapshot['saveState'] = 'saved'): WriterSnapshot {
	return {
		draftId: 'draft-1',
		title: '测试',
		languageId: 'generic',
		committedContent: '第一行\n',
		currentSegment: '最近输入',
		fullContent: '第一行\n最近输入',
		decoyText: '// T',
		charCount: 8,
		localRevision: 1,
		baseRevision: 1,
		saveState,
		lastInputSequence: 1,
	};
}

suite('Status Bar Presenter', () => {
	test('formats bounded real preview, count, and save state', () => {
		const text = formatWritingStatus(makeSnapshot('saving'), 4, true);
		assert.ok(text.includes('最近输入'));
		assert.ok(text.includes('8 字'));
		assert.ok(text.includes('保存中'));
		assert.ok(!text.includes('第一行'));
	});

	test('removes preview after the idle timeout while retaining count and state', async () => {
		const item = new FakeStatusBarItem();
		const presenter = new StatusBarPresenter(item as unknown as vscode.StatusBarItem, {
			previewLength: 20,
			previewTimeoutMs: 10,
		});
		presenter.enterWriting(makeSnapshot());
		assert.ok(item.text.includes('最近输入'));
		await new Promise(resolve => setTimeout(resolve, 30));
		assert.ok(!item.text.includes('最近输入'));
		assert.ok(item.text.includes('8 字'));
		presenter.dispose();
	});

	test('zero preview length disables real text and emergency hide clears visibility', () => {
		const item = new FakeStatusBarItem();
		const presenter = new StatusBarPresenter(item as unknown as vscode.StatusBarItem, {
			previewLength: 0,
			previewTimeoutMs: 3000,
		});
		presenter.enterWriting(makeSnapshot());
		assert.ok(!item.text.includes('最近输入'));
		presenter.emergencyHide();
		assert.strictEqual(item.visible, false);
		presenter.dispose();
	});
});
