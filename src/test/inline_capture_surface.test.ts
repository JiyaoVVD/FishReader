import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	appendInlineCaptureText,
	deleteInlineCaptureText,
	getInlineCaptureCamouflageText,
	InlineCaptureWritingSurface,
	shouldStopForDocumentChange,
} from '../writing/inline_capture_surface';
import { resolveWritingSurfaceKind, shouldHideForWindowState } from '../writing/writing_controller';
import { WriterSnapshot } from '../writing/writing_types';

function makeSnapshot(currentSegment = '', decoyText = ''): WriterSnapshot {
	return {
		draftId: 'draft-1',
		title: '测试草稿',
		languageId: 'typescript',
		committedContent: '',
		currentSegment,
		fullContent: currentSegment,
		decoyText,
		charCount: currentSegment.length,
		localRevision: 0,
		baseRevision: 0,
		saveState: 'saved',
		lastInputSequence: -1,
	};
}

suite('Inline Capture Writing Surface', () => {
	test('appends committed text and deletes one complete grapheme', () => {
		assert.strictEqual(appendInlineCaptureText('前文', '输入'), '前文输入');
		assert.strictEqual(deleteInlineCaptureText('A👨‍👩‍👧‍👦'), 'A');
	});

	test('renders only a plausible camouflage prefix', () => {
		assert.strictEqual(
			getInlineCaptureCamouflageText(makeSnapshot()),
			'// TODO: validate cached state before restoring',
		);
		const camouflage = getInlineCaptureCamouflageText(makeSnapshot('秘密', '//'));
		assert.ok(camouflage.startsWith('//'));
		assert.ok(camouflage.length >= 8);
		assert.ok(!camouflage.includes('秘密'));
	});

	test('detects only anchored source content changes', () => {
		assert.strictEqual(shouldStopForDocumentChange('file:///a.ts', 'file:///a.ts', 1), true);
		assert.strictEqual(shouldStopForDocumentChange('file:///a.ts', 'file:///b.ts', 1), false);
		assert.strictEqual(shouldStopForDocumentChange('file:///a.ts', 'file:///a.ts', 0), false);
	});

	test('ignores IME focus-only transitions but hides when fully inactive', () => {
		assert.strictEqual(shouldHideForWindowState({ focused: true, active: true }), false);
		assert.strictEqual(shouldHideForWindowState({ focused: false, active: true }), false);
		assert.strictEqual(shouldHideForWindowState({ focused: false, active: false }), true);
	});

	test('falls back to Webview for editor-dependent surfaces only when no editor exists', () => {
		assert.strictEqual(resolveWritingSurfaceKind('decoration', true), 'decoration');
		assert.strictEqual(resolveWritingSurfaceKind('decoration', false), 'webview');
		assert.strictEqual(resolveWritingSurfaceKind('comment', false), 'webview');
		assert.strictEqual(resolveWritingSurfaceKind('webview', false), 'webview');
	});

	test('moves a line-end decoration without changing source text or version', async () => {
		const document = await vscode.workspace.openTextDocument({
			language: 'typescript',
			content: 'const first = 1;\nconst second = 2;',
		});
		const editor = await vscode.window.showTextDocument(document);
		const beforeText = document.getText();
		const beforeVersion = document.version;
		const surface = new InlineCaptureWritingSurface(editor, makeSnapshot());
		try {
			assert.strictEqual(surface.line, 0);
			editor.selection = new vscode.Selection(1, 0, 1, 0);
			surface.moveTo(editor);
			assert.strictEqual(surface.line, 1);
			surface.render(makeSnapshot('秘密', '// TODO'));
			assert.strictEqual(document.getText(), beforeText);
			assert.strictEqual(document.version, beforeVersion);
		} finally {
			surface.dispose();
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
	});

	test('captures typed text without inserting it into the active source document', async () => {
		const extension = vscode.extensions.getExtension('undefined_publisher.fishreader');
		await extension?.activate();
		const document = await vscode.workspace.openTextDocument({
			language: 'typescript',
			content: 'const sourceMustRemain = true;',
		});
		await vscode.window.showTextDocument(document);
		const beforeText = document.getText();
		const beforeVersion = document.version;
		try {
			await vscode.commands.executeCommand('fishreader.startWriting');
			await vscode.commands.executeCommand('type', { text: '这是真实草稿' });
			await vscode.commands.executeCommand('compositionStart', {});
			await vscode.commands.executeCommand('replacePreviousChar', { text: 'n', replaceCharCnt: 0 });
			await vscode.commands.executeCommand('replacePreviousChar', { text: 'ni', replaceCharCnt: 1 });
			await vscode.commands.executeCommand('compositionType', {
				text: '你',
				replacePrevCharCnt: 2,
				replaceNextCharCnt: 0,
				positionDelta: 0,
			});
			await vscode.commands.executeCommand('compositionEnd', {});
			await vscode.commands.executeCommand('fishreader.inlineBackspace');
			await vscode.commands.executeCommand('fishreader.inlineSubmit');
			assert.strictEqual(document.getText(), beforeText);
			assert.strictEqual(document.version, beforeVersion);
		} finally {
			await vscode.commands.executeCommand('fishreader.exitWriting');
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
	});

	test('normal typing still delegates to the editor while inline capture is inactive', async () => {
		const extension = vscode.extensions.getExtension('undefined_publisher.fishreader');
		await extension?.activate();
		const document = await vscode.workspace.openTextDocument({ language: 'plaintext', content: '' });
		await vscode.window.showTextDocument(document);
		try {
			await vscode.commands.executeCommand('type', { text: 'normal' });
			assert.strictEqual(document.getText(), 'normal');
		} finally {
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
	});

	test('IME composition commands delegate to the editor while inline capture is inactive', async () => {
		const extension = vscode.extensions.getExtension('undefined_publisher.fishreader');
		await extension?.activate();
		const document = await vscode.workspace.openTextDocument({ language: 'plaintext', content: '' });
		await vscode.window.showTextDocument(document);
		try {
			await vscode.commands.executeCommand('compositionStart', {});
			await vscode.commands.executeCommand('replacePreviousChar', { text: 'n', replaceCharCnt: 0 });
			await vscode.commands.executeCommand('replacePreviousChar', { text: '你', replaceCharCnt: 1 });
			await vscode.commands.executeCommand('compositionEnd', {});
			assert.strictEqual(document.getText(), '你');
		} finally {
			await vscode.commands.executeCommand('compositionEnd', {});
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
	});

	test('manifest scopes mutating key overrides to inline capture', () => {
		const manifestPath = path.join(__dirname, '..', '..', 'package.json');
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
			contributes: {
				commands: Array<{ command: string; title: string }>;
				keybindings: Array<{ command: string; key: string; when?: string }>;
			};
		};
		assert.strictEqual(
			manifest.contributes.commands.find(command => command.command === 'fishreader.startWriting')?.title,
			'FishReader: Start Inline Capture',
		);
		assert.ok(manifest.contributes.commands.some(
			command => command.command === 'fishreader.startInlineCommentWriting',
		));
		const inlineBindings = manifest.contributes.keybindings.filter(binding =>
			binding.command.startsWith('fishreader.inline')
			|| (binding.command === 'fishreader.emergencyHideWriting' && binding.key === 'escape'),
		);
		assert.ok(inlineBindings.length >= 8);
		assert.ok(inlineBindings.every(binding =>
			binding.when === 'fishreader.inlineCaptureActive && editorTextFocus',
		));
	});
});
