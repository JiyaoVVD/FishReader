export const DRAFT_INDEX_VERSION = 1;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type FishReaderMode = 'reading' | 'writing';
export type WritingSurfaceKind = 'decoration' | 'comment' | 'webview';

export interface DraftMetadata {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	charCount: number;
	revision: number;
}

export interface DraftIndex {
	version: typeof DRAFT_INDEX_VERSION;
	activeDraftId?: string;
	drafts: DraftMetadata[];
}

export interface LoadedDraft {
	metadata: DraftMetadata;
	content: string;
}

export interface WriterSnapshot {
	draftId: string;
	title: string;
	languageId: string;
	committedContent: string;
	currentSegment: string;
	fullContent: string;
	decoyText: string;
	charCount: number;
	localRevision: number;
	baseRevision: number;
	saveState: SaveState;
	lastInputSequence: number;
}

export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'input'; value: string; sequence: number }
	| { type: 'submit'; value: string; sequence: number }
	| { type: 'compositionStart' }
	| { type: 'compositionEnd'; value: string; sequence: number }
	| { type: 'emergencyHide' }
	| { type: 'exit' };

export interface HostToWebviewRenderMessage {
	type: 'render';
	state: {
		currentSegment: string;
		decoyText: string;
		saveState: SaveState;
	};
}

export type SaveDraftResult =
	| { status: 'saved'; metadata: DraftMetadata }
	| { status: 'conflict'; metadata: DraftMetadata; storedContent: string; incomingContent: string }
	| { status: 'error'; error: Error; incomingContent: string };
