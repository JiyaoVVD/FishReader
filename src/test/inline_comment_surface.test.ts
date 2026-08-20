import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { InlineCommentWritingSurface, getInlineCamouflageText } from '../writing/inline_comment_surface';
import { resolveWritingSurfaceKind } from '../writing/writing_controller';
import { WriterSnapshot } from '../writing/writing_types';

function makeSnapshot(decoyText = ''): WriterSnapshot {
	return {
		draftId: 'draft-1',
		title: '测试草稿',
		languageId: 'typescript',
		committedContent: '',
		currentSegment: '',
		fullContent: '',
		decoyText,
		charCount: 0,
		localRevision: 0,
		baseRevision: 0,
		saveState: 'saved',
		lastInputSequence: -1,
	};
}

suite('Inline Comment Writing Surface', () => {
	test('uses only camouflage content and a language fallback', () => {
		assert.strictEqual(getInlineCamouflageText(makeSnapshot('// fake')), '// fake');
		assert.strictEqual(
			getInlineCamouflageText(makeSnapshot()),
			'// TODO: validate cached state before restoring',
		);
	});

	test('falls back to Webview only when inline mode has no active editor', () => {
		assert.strictEqual(resolveWritingSurfaceKind('comment', true), 'comment');
		assert.strictEqual(resolveWritingSurfaceKind('comment', false), 'webview');
		assert.strictEqual(resolveWritingSurfaceKind('decoration', false), 'webview');
		assert.strictEqual(resolveWritingSurfaceKind('webview', true), 'webview');
	});

	test('attaches to the current line without changing the document', async () => {
		const document = await vscode.workspace.openTextDocument({
			language: 'typescript',
			content: 'const value = 1;\nreturn value;',
		});
		const editor = await vscode.window.showTextDocument(document);
		editor.selection = new vscode.Selection(1, 0, 1, 0);
		const beforeText = document.getText();
		const beforeVersion = document.version;
		const surface = new InlineCommentWritingSurface(editor, makeSnapshot());
		try {
			assert.strictEqual(surface.uri.toString(), document.uri.toString());
			assert.strictEqual(surface.line, 1);
			surface.render(makeSnapshot('// review implementation'));
			assert.strictEqual(document.getText(), beforeText);
			assert.strictEqual(document.version, beforeVersion);
		} finally {
			surface.dispose();
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
	});

	test('contributed command titles are English and FishReader-prefixed', () => {
		const manifestPath = path.join(__dirname, '..', '..', 'package.json');
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
			contributes: { commands: Array<{ command: string; title: string }> };
		};
		const writingCommands = manifest.contributes.commands.filter(command =>
			command.command.startsWith('fishreader.'),
		);
		assert.ok(writingCommands.some(command => command.command === 'fishreader.startWriting'));
		assert.ok(writingCommands.some(command => command.command === 'fishreader.startInlineCommentWriting'));
		assert.ok(writingCommands.some(command => command.command === 'fishreader.startWebviewWriting'));
		assert.ok(writingCommands.every(command => command.title.startsWith('FishReader: ')));
	});
});
