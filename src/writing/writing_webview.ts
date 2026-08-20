import * as crypto from 'crypto';
import * as vscode from 'vscode';
import {
	HostToWebviewRenderMessage,
	SaveState,
	WebviewToHostMessage,
	WriterSnapshot,
} from './writing_types';

export interface WritingSurfaceCallbacks {
	onMessage(message: WebviewToHostMessage): void | Promise<void>;
	onVisibilityChange(visible: boolean): void | Promise<void>;
	onDispose(): void | Promise<void>;
}

export interface WritingRenderModel {
	currentSegment: string;
	decoyText: string;
	saveState: SaveState;
}

export function buildWritingRenderModel(snapshot: WriterSnapshot): WritingRenderModel {
	return {
		currentSegment: snapshot.currentSegment,
		decoyText: snapshot.decoyText,
		saveState: snapshot.saveState,
	};
}

export function parseWebviewMessage(value: unknown): WebviewToHostMessage | undefined {
	if (!value || typeof value !== 'object') {
		return undefined;
	}
	const candidate = value as Record<string, unknown>;
	if (candidate.type === 'ready' || candidate.type === 'emergencyHide' || candidate.type === 'exit' || candidate.type === 'compositionStart') {
		return { type: candidate.type } as WebviewToHostMessage;
	}
	if (
		(candidate.type === 'input' || candidate.type === 'submit' || candidate.type === 'compositionEnd')
		&& typeof candidate.value === 'string'
		&& Number.isSafeInteger(candidate.sequence)
		&& (candidate.sequence as number) >= 0
	) {
		return {
			type: candidate.type,
			value: candidate.value,
			sequence: candidate.sequence as number,
		} as WebviewToHostMessage;
	}
	return undefined;
}

export class WritingWebviewSurface implements vscode.Disposable {
	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];
	private disposed = false;

	constructor(
		viewColumn: vscode.ViewColumn,
		languageId: string,
		private readonly callbacks: WritingSurfaceCallbacks,
	) {
		this.panel = vscode.window.createWebviewPanel(
			'fishreader.stealthWriter',
			'Implementation Notes',
			{ viewColumn, preserveFocus: false },
			{
				enableScripts: true,
				retainContextWhenHidden: false,
			},
		);
		this.panel.webview.html = this.getHtml(this.panel.webview, languageId);
		this.disposables.push(
			this.panel.webview.onDidReceiveMessage(value => {
				const message = parseWebviewMessage(value);
				if (message) {
					void this.callbacks.onMessage(message);
				}
			}),
			this.panel.onDidChangeViewState(event => {
				void this.callbacks.onVisibilityChange(event.webviewPanel.active && event.webviewPanel.visible);
			}),
			this.panel.onDidDispose(() => {
				if (this.disposed) {
					return;
				}
				this.disposed = true;
				void this.callbacks.onDispose();
			}),
		);
	}

	reveal(viewColumn?: vscode.ViewColumn): void {
		this.panel.reveal(viewColumn, false);
	}

	render(snapshot: WriterSnapshot): Thenable<boolean> {
		const message: HostToWebviewRenderMessage = {
			type: 'render',
			state: buildWritingRenderModel(snapshot),
		};
		return this.panel.webview.postMessage(message);
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.panel.dispose();
	}

	private getHtml(webview: vscode.Webview, languageId: string): string {
		const nonce = crypto.randomBytes(16).toString('base64');
		const escapedLanguage = escapeHtml(languageId || 'text');
		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style nonce="${nonce}">
		:root { color-scheme: light dark; }
		* { box-sizing: border-box; }
		body {
			margin: 0;
			padding: 0;
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			font-weight: var(--vscode-editor-font-weight);
		}
		.editor-row {
			display: grid;
			grid-template-columns: 3.5rem minmax(0, 1fr);
			min-height: 1.6em;
			line-height: 1.6em;
			border-top: 1px solid transparent;
			border-bottom: 1px solid var(--vscode-editorWidget-border, transparent);
		}
		.gutter {
			padding-right: 1rem;
			text-align: right;
			user-select: none;
			color: var(--vscode-editorLineNumber-foreground);
			background: var(--vscode-editorGutter-background, var(--vscode-editor-background));
		}
		.line {
			position: relative;
			min-width: 0;
			overflow: hidden;
		}
		.decoy, .real-input {
			position: absolute;
			inset: 0;
			margin: 0;
			padding: 0 0.5rem;
			border: 0;
			outline: 0;
			font: inherit;
			line-height: inherit;
			white-space: pre;
			overflow: hidden;
		}
		.decoy {
			pointer-events: none;
			color: var(--vscode-editor-foreground);
		}
		.real-input {
			resize: none;
			background: transparent;
			color: transparent;
			caret-color: transparent;
			-webkit-text-fill-color: transparent;
			text-decoration-color: transparent;
			selection-color: transparent;
		}
		.real-input::selection { background: transparent; color: transparent; }
		.real-input:focus + .focus-line {
			position: absolute;
			left: 0;
			right: 0;
			bottom: 0;
			height: 1px;
			background: var(--vscode-focusBorder);
		}
		.badge {
			position: fixed;
			right: 0.75rem;
			bottom: 0.4rem;
			color: var(--vscode-descriptionForeground);
			font-size: 0.85em;
			user-select: none;
		}
	</style>
</head>
<body>
	<div class="editor-row">
		<div class="gutter">1</div>
		<div class="line">
			<div id="decoy" class="decoy" aria-hidden="true">// TODO: review current implementation</div>
			<textarea id="realInput" class="real-input" rows="1" wrap="off" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="Implementation note"></textarea>
			<div class="focus-line" aria-hidden="true"></div>
		</div>
	</div>
	<div class="badge">${escapedLanguage}</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const input = document.getElementById('realInput');
		const decoy = document.getElementById('decoy');
		let sequence = 0;
		let composing = false;
		let lastRenderedValue = '';

		function post(type, value) {
			sequence += 1;
			vscode.postMessage(value === undefined ? { type } : { type, value, sequence });
		}

		input.addEventListener('compositionstart', () => {
			composing = true;
			vscode.postMessage({ type: 'compositionStart' });
		});
		input.addEventListener('compositionend', () => {
			composing = false;
			post('compositionEnd', input.value);
		});
		input.addEventListener('input', () => {
			if (!composing) {
				post('input', input.value);
			}
		});
		input.addEventListener('keydown', event => {
			if (event.key === 'Escape') {
				event.preventDefault();
				vscode.postMessage({ type: 'emergencyHide' });
				return;
			}
			if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) {
				event.preventDefault();
				post('submit', input.value);
				input.value = '';
			}
		});
		window.addEventListener('message', event => {
			const message = event.data;
			if (!message || message.type !== 'render') {
				return;
			}
			const state = message.state;
			decoy.textContent = state.decoyText || '// TODO: review current implementation';
			if (!composing && state.currentSegment !== lastRenderedValue) {
				input.value = state.currentSegment;
				lastRenderedValue = state.currentSegment;
				input.setSelectionRange(input.value.length, input.value.length);
			}
		});
		input.addEventListener('input', () => { lastRenderedValue = input.value; });
		window.addEventListener('load', () => {
			input.focus();
			vscode.postMessage({ type: 'ready' });
		});
	</script>
</body>
</html>`;
	}
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
