import * as vscode from 'vscode';
import { formatPreview } from './grapheme_utils';
import { SaveState, WriterSnapshot } from './writing_types';

export interface WritingStatusOptions {
	previewLength: number;
	previewTimeoutMs: number;
}

const SAVE_LABELS: Readonly<Record<SaveState, string>> = {
	idle: '待保存',
	saving: '保存中',
	saved: '已保存',
	error: '保存失败',
	conflict: '保存冲突',
};

export function formatWritingStatus(
	snapshot: WriterSnapshot,
	previewLength: number,
	includePreview: boolean,
): string {
	const preview = includePreview ? formatPreview(snapshot.fullContent, previewLength) : '';
	const parts = [`${snapshot.charCount} 字`, SAVE_LABELS[snapshot.saveState]];
	if (preview) {
		parts.unshift(`……${preview}`);
	}
	return `$(edit) ${parts.join(' · ')}`;
}

export class StatusBarPresenter implements vscode.Disposable {
	private mode: 'reading' | 'writing' = 'reading';
	private readingText = '$(book) 暂无内容';
	private readingWasVisible = true;
	private writingSnapshot: WriterSnapshot | undefined;
	private previewVisible = false;
	private previewTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private readonly item: vscode.StatusBarItem,
		private options: WritingStatusOptions,
		private readonly readingCommand = 'fishreader.selectChapter',
	) {
		this.item.command = this.readingCommand;
		this.item.tooltip = '正文';
		this.item.text = this.readingText;
	}

	setReadingText(text: string): void {
		this.readingText = text;
		if (this.mode === 'reading') {
			this.item.text = text;
		}
	}

	enterWriting(snapshot: WriterSnapshot): void {
		this.mode = 'writing';
		this.writingSnapshot = snapshot;
		this.item.command = 'fishreader.resumeWriting';
		this.item.tooltip = '隐秘码字：最近输入与保存状态';
		this.updateWriting(snapshot, true);
		this.item.show();
	}

	updateOptions(options: WritingStatusOptions): void {
		this.options = options;
		if (this.mode === 'writing' && this.writingSnapshot) {
			this.renderWriting();
		}
	}

	updateWriting(snapshot: WriterSnapshot, revealPreview: boolean): void {
		this.writingSnapshot = snapshot;
		this.previewVisible = revealPreview && this.options.previewLength > 0;
		this.renderWriting();
		this.resetPreviewTimer();
	}

	updateSaveState(snapshot: WriterSnapshot): void {
		this.writingSnapshot = snapshot;
		this.renderWriting();
	}

	private renderWriting(): void {
		if (!this.writingSnapshot) {
			return;
		}
		this.item.text = formatWritingStatus(
			this.writingSnapshot,
			this.options.previewLength,
			this.previewVisible,
		);
	}

	private resetPreviewTimer(): void {
		if (this.previewTimer) {
			clearTimeout(this.previewTimer);
		}
		this.previewTimer = undefined;
		if (!this.previewVisible) {
			return;
		}
		this.previewTimer = setTimeout(() => {
			this.previewVisible = false;
			this.renderWriting();
		}, Math.max(0, this.options.previewTimeoutMs));
	}

	hide(): void {
		if (this.mode === 'reading') {
			this.readingWasVisible = false;
		}
		this.item.hide();
	}

	show(): void {
		if (this.mode === 'reading') {
			this.readingWasVisible = true;
			this.item.text = this.readingText;
		} else if (this.writingSnapshot) {
			this.previewVisible = false;
			this.renderWriting();
		}
		this.item.show();
	}

	emergencyHide(): void {
		this.previewVisible = false;
		if (this.previewTimer) {
			clearTimeout(this.previewTimer);
			this.previewTimer = undefined;
		}
		this.item.hide();
	}

	exitWriting(): void {
		this.mode = 'reading';
		this.writingSnapshot = undefined;
		this.previewVisible = false;
		if (this.previewTimer) {
			clearTimeout(this.previewTimer);
			this.previewTimer = undefined;
		}
		this.item.command = this.readingCommand;
		this.item.tooltip = '正文';
		this.item.text = this.readingText;
		if (this.readingWasVisible) {
			this.item.show();
		} else {
			this.item.hide();
		}
	}

	dispose(): void {
		if (this.previewTimer) {
			clearTimeout(this.previewTimer);
		}
		this.item.dispose();
	}
}
