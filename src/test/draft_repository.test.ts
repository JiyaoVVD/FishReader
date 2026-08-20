import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	DraftFileSystem,
	DraftRepository,
	DraftSaveScheduler,
	MementoLike,
} from '../writing/draft_repository';
import { DraftIndex } from '../writing/writing_types';

class FakeMemento implements MementoLike {
	readonly values = new Map<string, unknown>();

	get<T>(key: string): T | undefined {
		return this.values.get(key) as T | undefined;
	}

	async update(key: string, value: unknown): Promise<void> {
		this.values.set(key, structuredClone(value));
	}
}

class FakeFileSystem implements DraftFileSystem {
	readonly files = new Map<string, Uint8Array>();
	failRename = false;

	async createDirectory(_uri: vscode.Uri): Promise<void> {}

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const content = this.files.get(uri.toString());
		if (!content) {
			throw new Error(`Missing file: ${uri}`);
		}
		return content;
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
		this.files.set(uri.toString(), Uint8Array.from(content));
	}

	async rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Promise<void> {
		if (this.failRename) {
			throw new Error('rename failed');
		}
		const content = await this.readFile(source);
		if (!options?.overwrite && this.files.has(target.toString())) {
			throw new Error('target exists');
		}
		this.files.set(target.toString(), content);
		this.files.delete(source.toString());
	}

	async delete(uri: vscode.Uri): Promise<void> {
		this.files.delete(uri.toString());
	}
}

function createRepository() {
	const state = new FakeMemento();
	const fs = new FakeFileSystem();
	let timestamp = 100;
	let id = 0;
	const repository = new DraftRepository(state, vscode.Uri.parse('mem:/fishreader'), {
		fileSystem: fs,
		now: () => ++timestamp,
		idFactory: () => `id-${++id}`,
	});
	return { repository, state, fs };
}

suite('Draft Repository', () => {
	test('creates, lists, loads, activates, and renames drafts', async () => {
		const { repository } = createRepository();
		await repository.initialize();
		const first = await repository.createDraft('第一份', '正文');
		await repository.createDraft('第二份');

		assert.strictEqual(repository.listDrafts().length, 2);
		assert.strictEqual(repository.getActiveDraftId(), 'id-3');
		assert.strictEqual((await repository.loadDraft(first.metadata.id)).content, '正文');

		await repository.setActiveDraft(first.metadata.id);
		assert.strictEqual(repository.getActiveDraftId(), first.metadata.id);
		const renamed = await repository.renameDraft(first.metadata.id, '新标题');
		assert.strictEqual(renamed.title, '新标题');
	});

	test('saves a complete body and acknowledges its revision', async () => {
		const { repository } = createRepository();
		await repository.initialize();
		const draft = await repository.createDraft('草稿');
		const result = await repository.saveDraft(draft.metadata.id, '甲\n乙', 0);
		assert.strictEqual(result.status, 'saved');
		if (result.status === 'saved') {
			assert.strictEqual(result.metadata.revision, 1);
			assert.strictEqual(result.metadata.charCount, 2);
		}
		assert.strictEqual((await repository.loadDraft(draft.metadata.id)).content, '甲\n乙');
	});

	test('atomic replacement failure retains the previous body', async () => {
		const { repository, fs } = createRepository();
		await repository.initialize();
		const draft = await repository.createDraft('草稿', '旧内容');
		fs.failRename = true;
		const result = await repository.saveDraft(draft.metadata.id, '新内容', 0);
		assert.strictEqual(result.status, 'error');
		assert.strictEqual((await repository.loadDraft(draft.metadata.id)).content, '旧内容');
	});

	test('detects a revision conflict and preserves both contents', async () => {
		const { repository, state } = createRepository();
		await repository.initialize();
		const draft = await repository.createDraft('草稿', '磁盘内容');
		const indexKey = 'fishreader.writing.draftIndex';
		const index = state.get<DraftIndex>(indexKey)!;
		index.drafts[0].revision = 2;
		await state.update(indexKey, index);

		const result = await repository.saveDraft(draft.metadata.id, '内存内容', 0);
		assert.strictEqual(result.status, 'conflict');
		if (result.status === 'conflict') {
			assert.strictEqual(result.storedContent, '磁盘内容');
			assert.strictEqual(result.incomingContent, '内存内容');
		}
	});

	test('reports a missing active body instead of replacing it', async () => {
		const { repository, fs } = createRepository();
		await repository.initialize();
		const draft = await repository.createDraft('草稿', '正文');
		const body = Array.from(fs.files.keys()).find(key => key.endsWith(`${draft.metadata.id}.txt`))!;
		fs.files.delete(body);
		await assert.rejects(repository.recoverActiveDraft(), /missing or unreadable/);
	});

	test('export cancellation leaves external files unchanged', async () => {
		const { repository, fs } = createRepository();
		await repository.initialize();
		const draft = await repository.createDraft('草稿', '正文');
		const before = fs.files.size;
		assert.strictEqual(await repository.exportDraft(draft.metadata.id, undefined), false);
		assert.strictEqual(fs.files.size, before);
	});

	test('exports UTF-8 content to an explicit target', async () => {
		const { repository, fs } = createRepository();
		await repository.initialize();
		const draft = await repository.createDraft('草稿', '中文正文');
		const target = vscode.Uri.parse('mem:/exports/draft.md');
		assert.strictEqual(await repository.exportDraft(draft.metadata.id, target), true);
		assert.strictEqual(Buffer.from(await fs.readFile(target)).toString('utf8'), '中文正文');
	});

	test('debounces and flushes scheduled saves', async () => {
		let calls = 0;
		const scheduler = new DraftSaveScheduler(1000, async () => {
			calls++;
		});
		scheduler.schedule();
		scheduler.schedule();
		await scheduler.flush();
		assert.strictEqual(calls, 1);
		scheduler.dispose();
	});
});
