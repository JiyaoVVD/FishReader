import * as assert from 'assert';
import * as crypto from 'crypto';
import * as os from 'os';
import * as vscode from 'vscode';
import { BookContentTree } from '../novel_utils/book_content_tree';
import { StatusBarReader } from '../status_bar_reader';
import { DraftRepository, MementoLike } from '../writing/draft_repository';
import { ModeController } from '../writing/mode_controller';
import { WriterSession } from '../writing/writer_session';

class MemoryMemento implements MementoLike {
	private readonly values = new Map<string, unknown>();
	get<T>(key: string): T | undefined { return this.values.get(key) as T | undefined; }
	async update(key: string, value: unknown): Promise<void> { this.values.set(key, value); }
}

function makeBook(): BookContentTree {
	return {
		title: '测试书',
		type: 'book',
		children: [
			{ title: '第一章', type: 'chapter', content: ['第一行内容', '第二行内容'] },
			{ title: '第二章', type: 'chapter', content: ['第三行内容'] },
		],
	};
}

suite('Writing Lifecycle Integration', () => {
	test('start, save, recover, resume, emergency hide, and exit preserve the reading cursor', async () => {
		const root = vscode.Uri.file(`${os.tmpdir()}/fishreader-writing-${crypto.randomUUID()}`);
		const storage = vscode.Uri.joinPath(root, 'global-storage');
		const workspaceProbe = vscode.Uri.joinPath(root, 'workspace', 'must-not-exist.txt');
		const state = new MemoryMemento();
		const repository = new DraftRepository(state, storage);
		await repository.initialize();

		const reader = new StatusBarReader(makeBook());
		reader.setChapter(1);
		const before = reader.getPosition();
		const mode = new ModeController();
		mode.startWriting();
		const draft = await repository.createDraft('集成草稿');
		const session = new WriterSession(draft, 'typescript');
		session.replaceCurrentSegment('中文输入', 1);
		const pending = session.getSnapshot();
		const result = await repository.saveDraft(pending.draftId, pending.fullContent, pending.baseRevision);
		assert.strictEqual(result.status, 'saved');
		if (result.status === 'saved') {
			session.markSaved(pending.localRevision, result.metadata.revision);
		}

		const recovered = await repository.recoverActiveDraft();
		assert.ok(recovered);
		assert.strictEqual(recovered!.content, '中文输入');
		mode.hideWritingPresentation();
		assert.strictEqual(mode.mode, 'writing');
		assert.strictEqual(mode.isWritingSurfaceVisible, false);
		mode.resumeWriting();
		assert.strictEqual(mode.isWritingSurfaceVisible, true);
		mode.exitWriting();
		assert.deepStrictEqual(reader.getPosition(), before);

		await assert.rejects(Promise.resolve(vscode.workspace.fs.stat(workspaceProbe)));
		await vscode.workspace.fs.delete(root, { recursive: true });
	});
});
