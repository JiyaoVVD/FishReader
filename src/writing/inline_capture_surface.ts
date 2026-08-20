import * as vscode from 'vscode';
import { CamouflageTemplateProvider } from './camouflage_templates';
import { deleteLastGraphemes, splitGraphemes } from './grapheme_utils';
import { WriterSnapshot } from './writing_types';

const MINIMUM_DECOY_GRAPHEMES = 8;

export function appendInlineCaptureText(currentSegment: string, text: string): string {
	return currentSegment + text;
}

export function deleteInlineCaptureText(currentSegment: string): string {
	return deleteLastGraphemes(currentSegment, 1);
}

export function shouldStopForDocumentChange(
	anchorUri: string,
	changedUri: string,
	contentChangeCount: number,
): boolean {
	return contentChangeCount > 0 && anchorUri === changedUri;
}

export function getInlineCaptureCamouflageText(
	snapshot: WriterSnapshot,
	templates = new CamouflageTemplateProvider(),
): string {
	const candidates = templates.getTemplates(snapshot.languageId);
	if (!snapshot.decoyText) {
		return candidates[0];
	}
	const candidate = candidates.find(template => template.startsWith(snapshot.decoyText));
	if (!candidate) {
		return snapshot.decoyText;
	}
	const visibleCount = Math.max(
		MINIMUM_DECOY_GRAPHEMES,
		splitGraphemes(snapshot.decoyText).length,
	);
	return splitGraphemes(candidate).slice(0, visibleCount).join('');
}

export class InlineCaptureWritingSurface implements vscode.Disposable {
	private readonly decorationType: vscode.TextEditorDecorationType;
	private editor: vscode.TextEditor;
	private anchorLine: number;
	private lastCamouflageText = '';
	private disposed = false;

	constructor(editor: vscode.TextEditor, snapshot: WriterSnapshot) {
		this.editor = editor;
		this.anchorLine = editor.selection.active.line;
		this.decorationType = vscode.window.createTextEditorDecorationType({
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			after: {
				margin: '0 0 0 1.25em',
				color: new vscode.ThemeColor('editorCodeLens.foreground'),
				fontStyle: 'italic',
			},
		});
		this.render(snapshot);
	}

	get uri(): vscode.Uri {
		return this.editor.document.uri;
	}

	get line(): number {
		return this.anchorLine;
	}

	get isDisposed(): boolean {
		return this.disposed;
	}

	matchesEditor(editor: vscode.TextEditor | undefined): boolean {
		return Boolean(editor && editor.document.uri.toString() === this.uri.toString());
	}

	containsDocumentChange(event: vscode.TextDocumentChangeEvent): boolean {
		return shouldStopForDocumentChange(
			this.uri.toString(),
			event.document.uri.toString(),
			event.contentChanges.length,
		);
	}

	moveTo(editor: vscode.TextEditor): void {
		if (this.disposed || !this.matchesEditor(editor)) {
			return;
		}
		if (this.editor !== editor) {
			this.editor.setDecorations(this.decorationType, []);
			this.editor = editor;
		}
		this.anchorLine = editor.selection.active.line;
		this.applyDecoration();
	}

	reveal(): void {
		this.applyDecoration();
	}

	render(snapshot: WriterSnapshot): void {
		if (this.disposed) {
			return;
		}
		this.lastCamouflageText = getInlineCaptureCamouflageText(snapshot);
		this.applyDecoration();
	}

	private applyDecoration(): void {
		if (this.disposed || this.editor.document.lineCount === 0) {
			return;
		}
		this.anchorLine = Math.min(this.anchorLine, this.editor.document.lineCount - 1);
		const lineEnd = this.editor.document.lineAt(this.anchorLine).range.end;
		const range = new vscode.Range(lineEnd, lineEnd);
		this.editor.setDecorations(this.decorationType, [{
			range,
			renderOptions: {
				after: { contentText: this.lastCamouflageText },
			},
		}]);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.editor.setDecorations(this.decorationType, []);
		this.decorationType.dispose();
	}
}
