import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { countDraftCharacters } from './grapheme_utils';
import {
	DRAFT_INDEX_VERSION,
	DraftIndex,
	DraftMetadata,
	LoadedDraft,
	SaveDraftResult,
} from './writing_types';

const DRAFT_INDEX_KEY = 'fishreader.writing.draftIndex';

export interface MementoLike {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Thenable<void>;
}

export interface DraftFileSystem {
	createDirectory(uri: vscode.Uri): Thenable<void>;
	readFile(uri: vscode.Uri): Thenable<Uint8Array>;
	writeFile(uri: vscode.Uri, content: Uint8Array): Thenable<void>;
	rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Thenable<void>;
	delete(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Thenable<void>;
}

export interface DraftRepositoryOptions {
	fileSystem?: DraftFileSystem;
	now?: () => number;
	idFactory?: () => string;
}

export class DraftRepository {
	private readonly draftsDirectory: vscode.Uri;
	private readonly fileSystem: DraftFileSystem;
	private readonly now: () => number;
	private readonly idFactory: () => string;

	constructor(
		private readonly state: MementoLike,
		globalStorageUri: vscode.Uri,
		options: DraftRepositoryOptions = {},
	) {
		this.draftsDirectory = vscode.Uri.joinPath(globalStorageUri, 'drafts');
		this.fileSystem = options.fileSystem ?? vscode.workspace.fs;
		this.now = options.now ?? Date.now;
		this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
	}

	async initialize(): Promise<void> {
		await this.fileSystem.createDirectory(this.draftsDirectory);
		const current = this.readIndex();
		if (!this.isValidIndex(current)) {
			await this.writeIndex(this.emptyIndex());
		}
	}

	private emptyIndex(): DraftIndex {
		return { version: DRAFT_INDEX_VERSION, drafts: [] };
	}

	private isValidIndex(value: DraftIndex | undefined): value is DraftIndex {
		return value?.version === DRAFT_INDEX_VERSION && Array.isArray(value.drafts);
	}

	private readIndex(): DraftIndex {
		const value = this.state.get<DraftIndex>(DRAFT_INDEX_KEY);
		if (!this.isValidIndex(value)) {
			return this.emptyIndex();
		}
		return {
			version: DRAFT_INDEX_VERSION,
			activeDraftId: value.activeDraftId,
			drafts: value.drafts.map(draft => ({ ...draft })),
		};
	}

	private async writeIndex(index: DraftIndex): Promise<void> {
		await this.state.update(DRAFT_INDEX_KEY, index);
	}

	private bodyUri(id: string): vscode.Uri {
		return vscode.Uri.joinPath(this.draftsDirectory, `${id}.txt`);
	}

	private temporaryBodyUri(id: string): vscode.Uri {
		return vscode.Uri.joinPath(this.draftsDirectory, `${id}.${this.idFactory()}.tmp`);
	}

	private async readBody(id: string): Promise<string> {
		const bytes = await this.fileSystem.readFile(this.bodyUri(id));
		return Buffer.from(bytes).toString('utf8');
	}

	private async writeBodyAtomic(id: string, content: string): Promise<void> {
		await this.fileSystem.createDirectory(this.draftsDirectory);
		const temporary = this.temporaryBodyUri(id);
		try {
			await this.fileSystem.writeFile(temporary, Buffer.from(content, 'utf8'));
			await this.fileSystem.rename(temporary, this.bodyUri(id), { overwrite: true });
		} catch (error) {
			try {
				await this.fileSystem.delete(temporary);
			} catch {
				// Best-effort cleanup. The original complete body remains authoritative.
			}
			throw error;
		}
	}

	listDrafts(): DraftMetadata[] {
		return this.readIndex().drafts
			.map(draft => ({ ...draft }))
			.sort((left, right) => right.updatedAt - left.updatedAt);
	}

	getActiveDraftId(): string | undefined {
		return this.readIndex().activeDraftId;
	}

	async createDraft(title?: string, initialContent = ''): Promise<LoadedDraft> {
		const now = this.now();
		const id = this.idFactory();
		const normalizedTitle = title?.trim() || `草稿 ${new Date(now).toLocaleString()}`;
		const metadata: DraftMetadata = {
			id,
			title: normalizedTitle,
			createdAt: now,
			updatedAt: now,
			charCount: countDraftCharacters(initialContent),
			revision: 0,
		};
		await this.writeBodyAtomic(id, initialContent);
		const index = this.readIndex();
		index.drafts.push(metadata);
		index.activeDraftId = id;
		await this.writeIndex(index);
		return { metadata: { ...metadata }, content: initialContent };
	}

	async loadDraft(id: string): Promise<LoadedDraft> {
		const metadata = this.readIndex().drafts.find(draft => draft.id === id);
		if (!metadata) {
			throw new Error(`Draft metadata not found: ${id}`);
		}
		try {
			const content = await this.readBody(id);
			return { metadata: { ...metadata }, content };
		} catch (error) {
			throw new Error(`Draft body is missing or unreadable: ${id}`, { cause: error });
		}
	}

	async recoverActiveDraft(): Promise<LoadedDraft | undefined> {
		const activeDraftId = this.getActiveDraftId();
		if (!activeDraftId) {
			return undefined;
		}
		return this.loadDraft(activeDraftId);
	}

	async setActiveDraft(id: string): Promise<void> {
		const index = this.readIndex();
		if (!index.drafts.some(draft => draft.id === id)) {
			throw new Error(`Draft metadata not found: ${id}`);
		}
		index.activeDraftId = id;
		await this.writeIndex(index);
	}

	async renameDraft(id: string, title: string): Promise<DraftMetadata> {
		const normalizedTitle = title.trim();
		if (!normalizedTitle) {
			throw new Error('Draft title cannot be empty');
		}
		const index = this.readIndex();
		const metadata = index.drafts.find(draft => draft.id === id);
		if (!metadata) {
			throw new Error(`Draft metadata not found: ${id}`);
		}
		metadata.title = normalizedTitle;
		metadata.updatedAt = this.now();
		await this.writeIndex(index);
		return { ...metadata };
	}

	async saveDraft(id: string, content: string, expectedRevision: number): Promise<SaveDraftResult> {
		const index = this.readIndex();
		const metadata = index.drafts.find(draft => draft.id === id);
		if (!metadata) {
			return {
				status: 'error',
				error: new Error(`Draft metadata not found: ${id}`),
				incomingContent: content,
			};
		}
		if (metadata.revision !== expectedRevision) {
			let storedContent = '';
			try {
				storedContent = await this.readBody(id);
			} catch {
				// Keep the conflict explicit even when the competing body is unreadable.
			}
			return {
				status: 'conflict',
				metadata: { ...metadata },
				storedContent,
				incomingContent: content,
			};
		}

		try {
			await this.writeBodyAtomic(id, content);
			metadata.revision++;
			metadata.updatedAt = this.now();
			metadata.charCount = countDraftCharacters(content);
			await this.writeIndex(index);
			return { status: 'saved', metadata: { ...metadata } };
		} catch (error) {
			return {
				status: 'error',
				error: error instanceof Error ? error : new Error(String(error)),
				incomingContent: content,
			};
		}
	}

	async exportDraft(id: string, target?: vscode.Uri): Promise<boolean> {
		if (!target) {
			return false;
		}
		const draft = await this.loadDraft(id);
		await this.fileSystem.writeFile(target, Buffer.from(draft.content, 'utf8'));
		return true;
	}
}

export class DraftSaveScheduler implements vscode.Disposable {
	private timer: ReturnType<typeof setTimeout> | undefined;
	private requested = false;
	private chain: Promise<void> = Promise.resolve();

	constructor(
		private delayMs: number,
		private readonly worker: () => Promise<void>,
	) {}

	setDelay(delayMs: number): void {
		this.delayMs = Math.max(0, delayMs);
	}

	schedule(): void {
		this.requested = true;
		if (this.timer) {
			clearTimeout(this.timer);
		}
		this.timer = setTimeout(() => {
			this.timer = undefined;
			void this.flush();
		}, this.delayMs);
	}

	async flush(): Promise<void> {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
		if (!this.requested) {
			await this.chain;
			return;
		}
		this.requested = false;
		this.chain = this.chain.then(this.worker, this.worker);
		await this.chain;
		if (this.requested && !this.timer) {
			await this.flush();
		}
	}

	dispose(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
		}
	}
}
