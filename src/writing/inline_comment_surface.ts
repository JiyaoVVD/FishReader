import * as vscode from 'vscode';
import { CamouflageTemplateProvider } from './camouflage_templates';
import { WriterSnapshot } from './writing_types';

export const INLINE_COMMENT_CONTROLLER_ID = 'fishreader-inline-writing';
export const INLINE_COMMENT_THREAD_CONTEXT = 'fishreader-inline-draft';

export function getInlineCamouflageText(
	snapshot: WriterSnapshot,
	templates = new CamouflageTemplateProvider(),
): string {
	return snapshot.decoyText || templates.getTemplates(snapshot.languageId)[0];
}

class CamouflageComment implements vscode.Comment {
	mode = vscode.CommentMode.Preview;
	author: vscode.CommentAuthorInformation = { name: 'Code Review' };
	contextValue = 'fishreader-camouflage-comment';

	constructor(
		public body: vscode.MarkdownString,
		public parent: vscode.CommentThread,
	) {}
}

export class InlineCommentWritingSurface implements vscode.Disposable {
	private readonly controller: vscode.CommentController;
	private readonly thread: vscode.CommentThread;
	private comment: CamouflageComment;
	private disposed = false;

	constructor(
		private readonly editor: vscode.TextEditor,
		snapshot: WriterSnapshot,
	) {
		this.controller = vscode.comments.createCommentController(
			INLINE_COMMENT_CONTROLLER_ID,
			'FishReader Inline Writing',
		);
		const line = editor.selection.active.line;
		const range = new vscode.Range(line, 0, line, 0);
		this.thread = this.controller.createCommentThread(editor.document.uri, range, []);
		this.thread.label = 'Implementation Review';
		this.thread.contextValue = INLINE_COMMENT_THREAD_CONTEXT;
		this.thread.canReply = true;
		this.thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
		this.comment = new CamouflageComment(this.makeBody(snapshot), this.thread);
		this.thread.comments = [this.comment];
		this.updateOptions(snapshot);
	}

	get uri(): vscode.Uri {
		return this.editor.document.uri;
	}

	get line(): number {
		return this.thread.range?.start.line ?? 0;
	}

	get isDisposed(): boolean {
		return this.disposed;
	}

	accepts(reply: vscode.CommentReply): boolean {
		return !this.disposed && reply.thread === this.thread;
	}

	consumeReply(reply: vscode.CommentReply): string | undefined {
		if (!this.accepts(reply) || !reply.text) {
			return undefined;
		}
		const text = reply.text;
		reply.text = '';
		return text;
	}

	reveal(): void {
		if (this.disposed) {
			return;
		}
		this.thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
		void vscode.window.showTextDocument(this.editor.document, {
			viewColumn: this.editor.viewColumn,
			preserveFocus: false,
			selection: this.thread.range,
		});
	}

	render(snapshot: WriterSnapshot): void {
		if (this.disposed) {
			return;
		}
		this.comment = new CamouflageComment(this.makeBody(snapshot), this.thread);
		this.thread.comments = [this.comment];
		this.updateOptions(snapshot);
		this.thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded;
	}

	private updateOptions(snapshot: WriterSnapshot): void {
		this.controller.options = {
			prompt: 'Add implementation note',
			placeHolder: getInlineCamouflageText(snapshot),
		};
	}

	private makeBody(snapshot: WriterSnapshot): vscode.MarkdownString {
		const body = new vscode.MarkdownString();
		body.appendCodeblock(getInlineCamouflageText(snapshot), snapshot.languageId || 'text');
		return body;
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.controller.dispose();
	}
}
