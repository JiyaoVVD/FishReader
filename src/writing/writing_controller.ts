import * as vscode from 'vscode';
import { DraftRepository, DraftSaveScheduler } from './draft_repository';
import {
	appendInlineCaptureText,
	deleteInlineCaptureText,
	InlineCaptureWritingSurface,
} from './inline_capture_surface';
import {
	applyInlineCompositionUpdate,
	InlineCompositionState,
	startInlineComposition,
} from './inline_composition';
import { InlineCommentWritingSurface } from './inline_comment_surface';
import { ModeController } from './mode_controller';
import { StatusBarPresenter } from './status_bar_presenter';
import { WriterSession } from './writer_session';
import { WebviewToHostMessage, WritingSurfaceKind } from './writing_types';
import { WritingWebviewSurface } from './writing_webview';

const WRITING_ACTIVE_CONTEXT = 'fishreader.writingActive';
const WRITING_FOCUSED_CONTEXT = 'fishreader.writingSurfaceFocused';
const INLINE_CAPTURE_ACTIVE_CONTEXT = 'fishreader.inlineCaptureActive';

interface ReplacePreviousCharArgs {
	text?: string;
	replaceCharCnt?: number;
}

interface CompositionTypeArgs {
	text?: string;
	replacePrevCharCnt?: number;
	replaceNextCharCnt?: number;
	positionDelta?: number;
}

export function shouldHideForWindowState(
	state: Pick<vscode.WindowState, 'focused' | 'active'>,
): boolean {
	return !state.focused && !state.active;
}

export function resolveWritingSurfaceKind(
	preferred: WritingSurfaceKind,
	hasActiveEditor: boolean,
): WritingSurfaceKind {
	return preferred !== 'webview' && !hasActiveEditor ? 'webview' : preferred;
}

export class WritingController implements vscode.Disposable {
	private readonly repository: DraftRepository;
	private readonly scheduler: DraftSaveScheduler;
	private readonly disposables: vscode.Disposable[] = [];
	private session: WriterSession | undefined;
	private surface: WritingWebviewSurface | undefined;
	private inlineCaptureSurface: InlineCaptureWritingSurface | undefined;
	private inlineComposition: InlineCompositionState | undefined;
	private inlineSurface: InlineCommentWritingSurface | undefined;
	private preferredSurfaceKind: WritingSurfaceKind = 'decoration';
	private languageId = 'generic';
	private viewColumn = vscode.ViewColumn.One;
	private closingSurface = false;
	private suppressConflictPrompt = false;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly mode: ModeController,
		private readonly presenter: StatusBarPresenter,
	) {
		this.repository = new DraftRepository(context.globalState, context.globalStorageUri);
		this.scheduler = new DraftSaveScheduler(this.getAutosaveDebounce(), () => this.saveCurrentSnapshot());
		this.disposables.push(
			...this.registerCommands(),
			vscode.workspace.onDidChangeTextDocument(event => {
				void this.handleDocumentChange(event);
			}),
			vscode.window.onDidChangeTextEditorSelection(event => {
				this.inlineCaptureSurface?.moveTo(event.textEditor);
			}),
			vscode.workspace.onDidChangeConfiguration(event => {
				if (event.affectsConfiguration('fishreader.writer.autosaveDebounce')) {
					this.scheduler.setDelay(this.getAutosaveDebounce());
				}
			}),
		);
	}

	async initialize(): Promise<void> {
		await this.repository.initialize();
		await this.setContext(false, false);
	}

	get isWriting(): boolean {
		return this.mode.mode === 'writing';
	}

	async startWriting(surfaceKind: WritingSurfaceKind = 'decoration'): Promise<void> {
		this.preferredSurfaceKind = surfaceKind;
		if (this.mode.mode === 'writing') {
			await this.resumeWriting(surfaceKind);
			return;
		}
		this.captureEditorContext();
		let draft;
		try {
			draft = await this.repository.recoverActiveDraft();
		} catch (error) {
			void vscode.window.showErrorMessage(this.describeError('无法恢复上次草稿', error));
			return;
		}
		draft ??= await this.chooseInitialDraft();
		if (!draft) {
			return;
		}
		this.session = new WriterSession(draft, this.languageId);
		this.mode.startWriting();
		await this.repository.setActiveDraft(draft.metadata.id);
		await this.setContext(true, true);
		this.presenter.enterWriting(this.session.getSnapshot());
		await this.openSurface();
	}

	async resumeWriting(surfaceKind: WritingSurfaceKind = this.preferredSurfaceKind): Promise<void> {
		this.preferredSurfaceKind = surfaceKind;
		this.captureEditorContext();
		if (!this.session) {
			let draft;
			try {
				draft = await this.repository.recoverActiveDraft();
			} catch (error) {
				void vscode.window.showErrorMessage(this.describeError('无法恢复上次草稿', error));
				return;
			}
			draft ??= await this.chooseInitialDraft();
			if (!draft) {
				return;
			}
			this.session = new WriterSession(draft, this.languageId);
		}
		this.mode.resumeWriting();
		await this.setContext(true, true);
		this.presenter.enterWriting(this.session.getSnapshot());
		await this.openSurface();
	}

	async exitWriting(): Promise<void> {
		if (this.mode.mode !== 'writing') {
			return;
		}
		await this.flushUnsaved();
		this.closeSurface();
		this.mode.exitWriting();
		await this.setContext(false, false);
		this.presenter.exitWriting();
	}

	async emergencyHide(): Promise<void> {
		if (this.mode.mode !== 'writing') {
			return;
		}
		this.presenter.emergencyHide();
		this.mode.hideWritingPresentation();
		this.suppressConflictPrompt = true;
		this.closeSurface();
		await this.setContext(true, false);
		try {
			await this.flushUnsaved();
		} finally {
			this.suppressConflictPrompt = false;
		}
	}

	showStatus(): void {
		this.presenter.show();
	}

	hideStatus(): void {
		this.presenter.hide();
	}

	async handleWindowStateChange(state: Pick<vscode.WindowState, 'focused' | 'active'>): Promise<void> {
		if (
			shouldHideForWindowState(state)
			&& this.mode.mode === 'writing'
			&& this.hasSurface()
			&& vscode.workspace.getConfiguration('fishreader').get<boolean>('writer.hideWhenFocusOut', true)
		) {
			await this.emergencyHide();
		}
	}

	async handleActiveEditorChange(editor: vscode.TextEditor | undefined): Promise<void> {
		const anchoredUri = this.inlineCaptureSurface?.uri ?? this.inlineSurface?.uri;
		if (
			anchoredUri
			&& (!editor || editor.document.uri.toString() !== anchoredUri.toString())
			&& this.mode.mode === 'writing'
			&& vscode.workspace.getConfiguration('fishreader').get<boolean>('writer.hideWhenFocusOut', true)
		) {
			await this.emergencyHide();
		}
	}

	private registerCommands(): vscode.Disposable[] {
		return [
			vscode.commands.registerCommand('fishreader.startWriting', () => this.startWriting('decoration')),
			vscode.commands.registerCommand('fishreader.startInlineCommentWriting', () => this.startWriting('comment')),
			vscode.commands.registerCommand('fishreader.startWebviewWriting', () => this.startWriting('webview')),
			vscode.commands.registerCommand('fishreader.resumeWriting', () => this.resumeWriting()),
			vscode.commands.registerCommand('fishreader.exitWriting', () => this.exitWriting()),
			vscode.commands.registerCommand('fishreader.emergencyHideWriting', () => this.emergencyHide()),
			vscode.commands.registerCommand('fishreader.newDraft', () => this.createNewDraft()),
			vscode.commands.registerCommand('fishreader.selectDraft', () => this.selectDraft()),
			vscode.commands.registerCommand('fishreader.renameDraft', () => this.renameDraft()),
			vscode.commands.registerCommand('fishreader.exportDraft', () => this.exportDraft()),
			vscode.commands.registerCommand('fishreader.submitInlineWriting', (reply: vscode.CommentReply) => this.handleInlineReply(reply)),
			vscode.commands.registerCommand('type', (args?: { text?: string }) => this.handleType(args)),
			vscode.commands.registerCommand('compositionStart', (args?: unknown) => this.handleCompositionStart(args)),
			vscode.commands.registerCommand('replacePreviousChar', (args?: ReplacePreviousCharArgs) => this.handleCompositionType(args, true)),
			vscode.commands.registerCommand('compositionType', (args?: CompositionTypeArgs) => this.handleCompositionType(args, false)),
			vscode.commands.registerCommand('compositionEnd', (args?: unknown) => this.handleCompositionEnd(args)),
			vscode.commands.registerCommand('fishreader.inlineBackspace', () => this.deleteInlineText()),
			vscode.commands.registerCommand('fishreader.inlineDelete', () => this.deleteInlineText()),
			vscode.commands.registerCommand('fishreader.inlineSubmit', () => this.submitInlineText()),
			vscode.commands.registerCommand('fishreader.inlinePaste', () => this.pasteInlineText()),
			vscode.commands.registerCommand('fishreader.inlineNoop', () => undefined),
		];
	}

	private async chooseInitialDraft() {
		const drafts = this.repository.listDrafts();
		if (drafts.length === 0) {
			return this.repository.createDraft();
		}
		const createId = '__create__';
		const selected = await vscode.window.showQuickPick([
			{ label: '$(add) 新建草稿', description: '创建一个空白本地草稿', draftId: createId },
			...drafts.map(draft => ({
				label: draft.title,
				description: `${draft.charCount} 字 · ${new Date(draft.updatedAt).toLocaleString()}`,
				draftId: draft.id,
			})),
		], { placeHolder: '选择已有草稿，或新建一个草稿' });
		if (!selected) {
			return undefined;
		}
		if (selected.draftId === createId) {
			return this.repository.createDraft();
		}
		const draft = await this.repository.loadDraft(selected.draftId);
		await this.repository.setActiveDraft(selected.draftId);
		return draft;
	}

	private async createNewDraft(): Promise<void> {
		const title = await vscode.window.showInputBox({
			prompt: '新草稿标题（此处仅用于草稿管理）',
			placeHolder: '留空将自动命名',
		});
		if (title === undefined) {
			return;
		}
		if (!(await this.canSwitchDraft())) {
			return;
		}
		this.captureEditorContext();
		const draft = await this.repository.createDraft(title);
		this.session = new WriterSession(draft, this.languageId);
		this.mode.startWriting();
		await this.setContext(true, true);
		this.presenter.enterWriting(this.session.getSnapshot());
		await this.replaceSurface();
	}

	private async selectDraft(): Promise<void> {
		const drafts = this.repository.listDrafts();
		if (drafts.length === 0) {
			void vscode.window.showInformationMessage('还没有可选择的草稿。');
			return;
		}
		const selected = await vscode.window.showQuickPick(
			drafts.map(draft => ({
				label: draft.title,
				description: `${draft.charCount} 字 · ${new Date(draft.updatedAt).toLocaleString()}`,
				draftId: draft.id,
			})),
			{ placeHolder: '选择本地隐秘草稿' },
		);
		if (!selected || !(await this.canSwitchDraft())) {
			return;
		}
		try {
			const draft = await this.repository.loadDraft(selected.draftId);
			await this.repository.setActiveDraft(selected.draftId);
			this.captureEditorContext();
			this.session = new WriterSession(draft, this.languageId);
			this.mode.startWriting();
			await this.setContext(true, true);
			this.presenter.enterWriting(this.session.getSnapshot());
			await this.replaceSurface();
		} catch (error) {
			void vscode.window.showErrorMessage(this.describeError('草稿无法打开', error));
		}
	}

	private async renameDraft(): Promise<void> {
		if (!this.session) {
			void vscode.window.showInformationMessage('请先开始或恢复一个草稿。');
			return;
		}
		const snapshot = this.session.getSnapshot();
		const title = await vscode.window.showInputBox({
			prompt: '重命名当前草稿',
			value: snapshot.title,
			validateInput: value => value.trim() ? undefined : '标题不能为空',
		});
		if (title === undefined) {
			return;
		}
		try {
			const renamed = await this.repository.renameDraft(snapshot.draftId, title);
			this.session.setTitle(renamed.title);
			this.updatePresentation(false);
		} catch (error) {
			void vscode.window.showErrorMessage(this.describeError('草稿重命名失败', error));
		}
	}

	private async exportDraft(): Promise<void> {
		if (!this.session) {
			void vscode.window.showInformationMessage('请先开始或恢复一个草稿。');
			return;
		}
		await this.flushUnsaved();
		const snapshot = this.session.getSnapshot();
		if (snapshot.saveState !== 'saved') {
			void vscode.window.showErrorMessage('当前草稿尚未安全保存，已取消导出。');
			return;
		}
		const safeTitle = snapshot.title.replace(/[\\/:*?"<>|]/g, '_');
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
		const defaultUri = workspaceRoot ? vscode.Uri.joinPath(workspaceRoot, `${safeTitle}.txt`) : undefined;
		const target = await vscode.window.showSaveDialog({
			defaultUri,
			filters: {
				'Text / Markdown': ['txt', 'md'],
			},
			title: '导出隐秘草稿副本',
		});
		if (!target) {
			return;
		}
		try {
			await this.repository.exportDraft(snapshot.draftId, target);
			void vscode.window.showInformationMessage(`草稿已导出到 ${target.fsPath}`);
		} catch (error) {
			void vscode.window.showErrorMessage(this.describeError('草稿导出失败', error));
		}
	}

	private async canSwitchDraft(): Promise<boolean> {
		if (!this.session) {
			return true;
		}
		await this.flushUnsaved();
		const state = this.session.getSnapshot().saveState;
		if (state === 'saved') {
			return true;
		}
		void vscode.window.showErrorMessage('当前草稿尚未安全保存，请先处理保存失败或冲突。');
		return false;
	}

	private captureEditorContext(): void {
		const editor = vscode.window.activeTextEditor;
		this.languageId = editor?.document.languageId || this.languageId || 'generic';
		this.viewColumn = editor?.viewColumn ?? this.viewColumn ?? vscode.ViewColumn.One;
	}

	private async openSurface(): Promise<void> {
		if (!this.session) {
			return;
		}
		const editor = vscode.window.activeTextEditor;
		const surfaceKind = resolveWritingSurfaceKind(this.preferredSurfaceKind, Boolean(editor));
		if (surfaceKind === 'decoration' && editor) {
			if (this.inlineCaptureSurface?.matchesEditor(editor)) {
				this.inlineCaptureSurface.reveal();
				this.inlineCaptureSurface.render(this.session.getSnapshot());
				await this.setContext(true, true, true);
				return;
			}
			if (this.hasSurface()) {
				this.closeSurface();
			}
			this.inlineCaptureSurface = new InlineCaptureWritingSurface(editor, this.session.getSnapshot());
			await this.setContext(true, true, true);
			return;
		}
		if (surfaceKind === 'comment' && editor) {
			if (this.inlineSurface) {
				this.inlineSurface.reveal();
				this.inlineSurface.render(this.session.getSnapshot());
				await this.setContext(true, true, false);
				return;
			}
			if (this.hasSurface()) {
				this.closeSurface();
			}
			this.inlineSurface = new InlineCommentWritingSurface(editor, this.session.getSnapshot());
			await this.setContext(true, true, false);
			return;
		}
		if (this.preferredSurfaceKind !== 'webview' && surfaceKind === 'webview') {
			void vscode.window.showInformationMessage('FishReader inline writing needs an active text editor. Falling back to the hidden Webview.');
		}
		if (this.surface) {
			this.surface.reveal(this.viewColumn);
			void this.surface.render(this.session.getSnapshot());
			await this.setContext(true, true, false);
			return;
		}
		if (this.hasSurface()) {
			this.closeSurface();
		}
		this.surface = new WritingWebviewSurface(this.viewColumn, this.languageId, {
			onMessage: message => this.handleWebviewMessage(message),
			onVisibilityChange: visible => this.handleSurfaceVisibility(visible),
			onDispose: () => this.handleSurfaceDisposed(),
		});
		void this.surface.render(this.session.getSnapshot());
		await this.setContext(true, true, false);
	}

	private async replaceSurface(): Promise<void> {
		this.closeSurface();
		await this.openSurface();
	}

	private closeSurface(): void {
		this.inlineComposition = undefined;
		if (this.inlineCaptureSurface) {
			const inlineCaptureSurface = this.inlineCaptureSurface;
			this.inlineCaptureSurface = undefined;
			inlineCaptureSurface.dispose();
		}
		if (this.inlineSurface) {
			const inlineSurface = this.inlineSurface;
			this.inlineSurface = undefined;
			inlineSurface.dispose();
		}
		if (this.surface) {
			this.closingSurface = true;
			const surface = this.surface;
			this.surface = undefined;
			surface.dispose();
			this.closingSurface = false;
		}
	}

	private hasSurface(): boolean {
		return Boolean(this.surface || this.inlineCaptureSurface || this.inlineSurface);
	}

	private handleType(args?: { text?: string }): Thenable<unknown> | void {
		if (!this.inlineCaptureSurface) {
			return vscode.commands.executeCommand('default:type', args);
		}
		if (!this.inlineCaptureSurface.matchesEditor(vscode.window.activeTextEditor)) {
			void this.emergencyHide();
			return;
		}
		if (args?.text) {
			if (this.inlineComposition) {
				this.inlineComposition = applyInlineCompositionUpdate(this.inlineComposition, {
					text: args.text,
				});
				return;
			}
			this.appendInlineText(args.text);
		}
	}

	private handleCompositionStart(args?: unknown): Thenable<unknown> | void {
		if (!this.inlineCaptureSurface) {
			return vscode.commands.executeCommand('default:compositionStart', args);
		}
		if (!this.inlineCaptureSurface.matchesEditor(vscode.window.activeTextEditor)) {
			void this.emergencyHide();
			return;
		}
		const currentSegment = this.session?.getSnapshot().currentSegment ?? '';
		this.inlineComposition = startInlineComposition(currentSegment);
	}

	private handleCompositionType(
		args: ReplacePreviousCharArgs | CompositionTypeArgs | undefined,
		replacePreviousChar: boolean,
	): Thenable<unknown> | void {
		const command = replacePreviousChar ? 'replacePreviousChar' : 'compositionType';
		if (!this.inlineCaptureSurface) {
			return vscode.commands.executeCommand(`default:${command}`, args);
		}
		if (!this.inlineCaptureSurface.matchesEditor(vscode.window.activeTextEditor)) {
			void this.emergencyHide();
			return;
		}
		const currentSegment = this.session?.getSnapshot().currentSegment ?? '';
		const state = this.inlineComposition ?? startInlineComposition(currentSegment);
		const text = typeof args?.text === 'string' ? args.text : '';
		this.inlineComposition = applyInlineCompositionUpdate(state, {
			text,
			replacePrevCharCount: replacePreviousChar
				? (args as ReplacePreviousCharArgs | undefined)?.replaceCharCnt
				: (args as CompositionTypeArgs | undefined)?.replacePrevCharCnt,
			replaceNextCharCount: replacePreviousChar
				? 0
				: (args as CompositionTypeArgs | undefined)?.replaceNextCharCnt,
			positionDelta: replacePreviousChar
				? 0
				: (args as CompositionTypeArgs | undefined)?.positionDelta,
		});
	}

	private handleCompositionEnd(args?: unknown): Thenable<unknown> | void {
		if (!this.inlineCaptureSurface) {
			return vscode.commands.executeCommand('default:compositionEnd', args);
		}
		if (!this.inlineCaptureSurface.matchesEditor(vscode.window.activeTextEditor)) {
			this.inlineComposition = undefined;
			void this.emergencyHide();
			return;
		}
		const composition = this.inlineComposition;
		this.inlineComposition = undefined;
		if (!composition || !this.session) {
			return;
		}
		const snapshot = this.session.getSnapshot();
		if (!this.session.replaceCurrentSegment(composition.value, snapshot.lastInputSequence + 1)) {
			return;
		}
		this.updatePresentation(true);
		this.scheduler.schedule();
	}

	private appendInlineText(text: string): void {
		if (!this.session || !this.inlineCaptureSurface || !text) {
			return;
		}
		const snapshot = this.session.getSnapshot();
		const value = appendInlineCaptureText(snapshot.currentSegment, text);
		if (!this.session.replaceCurrentSegment(value, snapshot.lastInputSequence + 1)) {
			return;
		}
		this.updatePresentation(true);
		this.scheduler.schedule();
	}

	private deleteInlineText(): void {
		if (!this.session || !this.inlineCaptureSurface) {
			return;
		}
		const snapshot = this.session.getSnapshot();
		const value = deleteInlineCaptureText(snapshot.currentSegment);
		if (!this.session.replaceCurrentSegment(value, snapshot.lastInputSequence + 1)) {
			return;
		}
		this.updatePresentation(true);
		this.scheduler.schedule();
	}

	private async submitInlineText(): Promise<void> {
		if (!this.session || !this.inlineCaptureSurface) {
			return;
		}
		const snapshot = this.session.getSnapshot();
		await this.handleWebviewMessage({
			type: 'submit',
			value: snapshot.currentSegment,
			sequence: snapshot.lastInputSequence + 1,
		});
	}

	private async pasteInlineText(): Promise<void> {
		if (!this.inlineCaptureSurface) {
			return;
		}
		const text = await vscode.env.clipboard.readText();
		this.appendInlineText(text);
	}

	private async handleDocumentChange(event: vscode.TextDocumentChangeEvent): Promise<void> {
		const surface = this.inlineCaptureSurface;
		if (!surface?.containsDocumentChange(event)) {
			return;
		}
		await this.emergencyHide();
		void vscode.window.showWarningMessage(
			'FishReader Inline Capture stopped because the anchored source document changed. Review or undo that source edit before resuming.',
		);
	}

	private async handleInlineReply(reply: vscode.CommentReply): Promise<void> {
		if (!this.session || !this.inlineSurface) {
			return;
		}
		const replyText = this.inlineSurface.consumeReply(reply);
		if (replyText === undefined) {
			return;
		}
		const snapshot = this.session.getSnapshot();
		const value = snapshot.currentSegment + replyText;
		await this.handleWebviewMessage({
			type: 'submit',
			value,
			sequence: snapshot.lastInputSequence + 1,
		});
	}

	private async handleWebviewMessage(message: WebviewToHostMessage): Promise<void> {
		if (!this.session) {
			return;
		}
		switch (message.type) {
			case 'ready':
				await this.surface?.render(this.session.getSnapshot());
				return;
			case 'compositionStart':
				return;
			case 'input':
			case 'compositionEnd':
				if (!this.session.replaceCurrentSegment(message.value, message.sequence)) {
					return;
				}
				break;
			case 'submit':
				if (!this.session.submitCurrentSegment(message.value, message.sequence)) {
					return;
				}
				this.updatePresentation(true);
				this.scheduler.schedule();
				await this.scheduler.flush();
				return;
			case 'emergencyHide':
				await this.emergencyHide();
				return;
			case 'exit':
				await this.exitWriting();
				return;
		}
		this.updatePresentation(true);
		this.scheduler.schedule();
	}

	private async handleSurfaceVisibility(visible: boolean): Promise<void> {
		await this.setContext(true, visible);
		if (
			!visible
			&& !this.closingSurface
			&& this.mode.mode === 'writing'
			&& vscode.workspace.getConfiguration('fishreader').get<boolean>('writer.hideWhenFocusOut', true)
		) {
			await this.emergencyHide();
		}
	}

	private async handleSurfaceDisposed(): Promise<void> {
		if (this.closingSurface) {
			return;
		}
		this.surface = undefined;
		this.mode.hideWritingPresentation();
		await this.setContext(this.mode.mode === 'writing', false);
		await this.flushUnsaved();
	}

	private updatePresentation(revealPreview: boolean): void {
		if (!this.session) {
			return;
		}
		const snapshot = this.session.getSnapshot();
		this.presenter.updateWriting(snapshot, revealPreview);
		void this.surface?.render(snapshot);
		this.inlineCaptureSurface?.render(snapshot);
		this.inlineSurface?.render(snapshot);
	}

	private async flushUnsaved(): Promise<void> {
		if (this.session && this.session.getSnapshot().saveState !== 'saved') {
			this.scheduler.schedule();
		}
		await this.scheduler.flush();
	}

	private async saveCurrentSnapshot(): Promise<void> {
		const targetSession = this.session;
		if (!targetSession) {
			return;
		}
		const request = targetSession.getSnapshot();
		targetSession.markSaving(request.localRevision);
		this.presenter.updateSaveState(targetSession.getSnapshot());
		void this.surface?.render(targetSession.getSnapshot());
		this.inlineCaptureSurface?.render(targetSession.getSnapshot());
		this.inlineSurface?.render(targetSession.getSnapshot());
		const result = await this.repository.saveDraft(
			request.draftId,
			request.fullContent,
			request.baseRevision,
		);
		if (this.session !== targetSession) {
			return;
		}
		if (result.status === 'saved') {
			targetSession.markSaved(request.localRevision, result.metadata.revision);
			this.presenter.updateSaveState(targetSession.getSnapshot());
			void this.surface?.render(targetSession.getSnapshot());
			this.inlineCaptureSurface?.render(targetSession.getSnapshot());
			this.inlineSurface?.render(targetSession.getSnapshot());
			return;
		}
		if (result.status === 'error') {
			targetSession.markSaveFailed(request.localRevision);
			this.presenter.updateSaveState(targetSession.getSnapshot());
			void this.surface?.render(targetSession.getSnapshot());
			this.inlineCaptureSurface?.render(targetSession.getSnapshot());
			this.inlineSurface?.render(targetSession.getSnapshot());
			return;
		}

		targetSession.markSaveFailed(request.localRevision, true);
		this.presenter.updateSaveState(targetSession.getSnapshot());
		void this.surface?.render(targetSession.getSnapshot());
		this.inlineCaptureSurface?.render(targetSession.getSnapshot());
		this.inlineSurface?.render(targetSession.getSnapshot());
		if (this.suppressConflictPrompt) {
			return;
		}
		const choice = await vscode.window.showWarningMessage(
			'草稿已在其他窗口修改。请选择保留当前文字的副本，或重新载入磁盘版本。',
			'另存为新草稿',
			'重新载入磁盘版',
		);
		if (choice === '另存为新草稿') {
			const copy = await this.repository.createDraft(`${request.title}（冲突副本）`, result.incomingContent);
			this.session = new WriterSession(copy, this.languageId);
			this.updatePresentation(false);
		} else if (choice === '重新载入磁盘版') {
			const stored = await this.repository.loadDraft(request.draftId);
			targetSession.replaceDraft(stored, this.languageId);
			this.updatePresentation(false);
		}
	}

	private getAutosaveDebounce(): number {
		return vscode.workspace.getConfiguration('fishreader').get<number>('writer.autosaveDebounce', 400);
	}

	private async setContext(active: boolean, focused: boolean, inlineCapture = false): Promise<void> {
		await Promise.all([
			vscode.commands.executeCommand('setContext', WRITING_ACTIVE_CONTEXT, active),
			vscode.commands.executeCommand('setContext', WRITING_FOCUSED_CONTEXT, focused),
			vscode.commands.executeCommand('setContext', INLINE_CAPTURE_ACTIVE_CONTEXT, inlineCapture),
		]);
	}

	private describeError(prefix: string, error: unknown): string {
		const detail = error instanceof Error ? error.message : String(error);
		return `${prefix}：${detail}`;
	}

	async shutdown(): Promise<void> {
		this.suppressConflictPrompt = true;
		try {
			await this.flushUnsaved();
		} finally {
			this.suppressConflictPrompt = false;
		}
	}

	dispose(): void {
		this.scheduler.dispose();
		this.closeSurface();
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}
}
