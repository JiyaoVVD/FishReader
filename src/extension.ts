import * as vscode from 'vscode';
import {loadNovelDir, loadNovelFile} from './novel_utils/novel_loader';
import {BookContentTree} from './novel_utils/book_content_tree';
import {StatusBarReader, ReadingPosition} from './status_bar_reader';
import { initCacheDir } from './novel_utils/book_cache';
import { ModeController } from './writing/mode_controller';
import { StatusBarPresenter } from './writing/status_bar_presenter';
import { WritingController } from './writing/writing_controller';

let activeWritingController: WritingController | undefined;

function saveProgress(globalState: vscode.Memento, bookPath: string, position: ReadingPosition): void {
	globalState.update(`progress:${bookPath}`, position);
}

function loadProgress(globalState: vscode.Memento, bookPath: string): ReadingPosition | undefined {
	return globalState.get<ReadingPosition>(`progress:${bookPath}`);
}

export class BookTreeDataProvider implements vscode.TreeDataProvider<BookTreeItem> {
  // 用于树视图刷新的事件触发器
	private _onDidChangeTreeData: vscode.EventEmitter<BookTreeItem | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<BookTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	private bookData: BookContentTree | undefined;

	private rootItems?: BookTreeItem[] = [];

	// 刷新整个树视图
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	// 更新数据源
	updateBookData(newData: BookContentTree): void {
		this.bookData = newData;
		this.refresh(); // 数据更新后触发视图刷新
	}

	// 获取树节点的显示项
	getTreeItem(element: BookTreeItem): vscode.TreeItem {
		return element;
	}

	getIndex(element: BookTreeItem): number {
		if (!this.bookData) {
			return -1;
		}
		return this.bookData.children?.indexOf(element.chapterData!) ?? -1;
	}

	// 获取节点的子节点
	async getChildren(element?: BookTreeItem): Promise<BookTreeItem[]> {
		if (!this.bookData) {
			return [new BookTreeItem('暂无内容', vscode.TreeItemCollapsibleState.None)];
		}

		// 根节点
		if(!element){
			// 初始化根节点
			if(this.bookData.children?.length !== this.rootItems?.length){
				this.rootItems = this.bookData.children?.map(child => {
					let childItem = new BookTreeItem(
						child.title || '未命名',
						child.type === "chapter" ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
						child // 将数据保存在item中，便于后续点击时获取
					);
					return childItem;
				});
			}
			return this.rootItems || [];
		}
		
		if(element.chapterData?.type === 'book'){
			if(element.chapterData?.content?.length === 1){	// 用content长度来判断是否加载
				let path = element.chapterData?.content?.[0];
				vscode.window.showInformationMessage(`加载书籍: ${element.label}，路径：${path}`);
				if(path){
					loadNovelFile(vscode.Uri.file(path), element.chapterData).then(data =>{
						// 初始化章节数据
						if(element.children?.length !== data.children?.length){
							element.children = data.children?.map(child => {
								let childItem = new BookTreeItem(
									child.title || '未命名',
									vscode.TreeItemCollapsibleState.None,
									child, // 将数据保存在item中，便于后续点击时获取
									element
								);
								return childItem;
							});
							this.refresh();
						}
						element.chapterData?.content?.push(""); // 占位，避免重复加载
					});
				}
			}
		}

		return element.children || [];
	}
}

// 自定义的树节点项
class BookTreeItem extends vscode.TreeItem {
	children?: BookTreeItem[];
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly chapterData?: BookContentTree, // 关联的数据
		public parent?: BookTreeItem
	) {
		super(label, collapsibleState);
		this.parent = parent;
		if(this.chapterData?.type === 'chapter'){
			this.command = {
				command: 'fishreader.openChapter',
				title: '打开章节',
				arguments: [this, this.parent] // 将节点自身作为参数传递给命令
			};
		}else if(this.chapterData?.type === 'book'){
			this.command = {
				command: 'fishreader.openBook',
				title: '打开书籍',
				arguments: [this, this.parent] // 将节点自身作为参数传递给命令
			};
		}else if(this.chapterData?.type === 'directory'){
			this.children = this.chapterData.children?.map(child => {
				let childItem = new BookTreeItem(
					child.title || 'unknown_folder',
					vscode.TreeItemCollapsibleState.Collapsed,
					child,
					this
				);
				return childItem;
			});
		}
	}

	getIndex(element: BookTreeItem): number{
		if (!this.chapterData) {
			return -1;
		}
		return this.chapterData.children?.indexOf(element.chapterData!) ?? -1;
	}
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const chapterTreeProvider = new BookTreeDataProvider();

	const statusBarReader = new StatusBarReader();
	let currentBookPath: string | undefined;
	const modeController = new ModeController();
	const contentStatusBar = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		0,
	);
	const writerConfig = vscode.workspace.getConfiguration('fishreader');
	const statusPresenter = new StatusBarPresenter(contentStatusBar, {
		previewLength: writerConfig.get<number>('writer.previewLength', 20),
		previewTimeoutMs: writerConfig.get<number>('writer.previewTimeout', 3000),
	});
	const writingController = new WritingController(context, modeController, statusPresenter);
	activeWritingController = writingController;
	await writingController.initialize();
	statusPresenter.setReadingText('$(book) 这里应该是内容');
	statusPresenter.show();
	context.subscriptions.push(statusPresenter, writingController);

	const updateReadingStatus = (): void => {
		statusPresenter.setReadingText(`$(book) ${statusBarReader.currentChapterTitle}: ${statusBarReader.showContent}`);
	};

	// Initialize cache directory
	initCacheDir(context.globalStorageUri);

	let bookPath = vscode.workspace.getConfiguration('fishreader').get<string>("defaultBookPath", "");
	if (bookPath) {
		loadNovelDir(vscode.Uri.file(bookPath)).then(data => {
			chapterTreeProvider.updateBookData(data);
			return data;
		});
	}

	// Restore last reading position
	const lastBook = context.globalState.get<string>('lastBook');
	if (lastBook) {
		vscode.workspace.fs.stat(vscode.Uri.file(lastBook)).then(
			() => {
				// File exists — load the book and restore progress
				loadNovelFile(vscode.Uri.file(lastBook)).then(bookData => {
					statusBarReader.bookData = bookData;
					currentBookPath = lastBook;
					const savedProgress = loadProgress(context.globalState, lastBook);
					if (savedProgress) {
						statusBarReader.setPosition(savedProgress);
					}
					updateReadingStatus();
				});
			},
			() => {
				// File no longer exists — silently skip
			}
		);
	}

	const configurationDisposable = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('fishreader.defaultBookPath')) {
			const newConfig = vscode.workspace.getConfiguration('fishreader');
			const newBookPath = newConfig.get<string>('defaultBookPath', '');
			if (newBookPath) {
				loadNovelDir(vscode.Uri.file(newBookPath)).then(data => {
					chapterTreeProvider.updateBookData(data);
					return data;
				});
			}
		}
		if(event.affectsConfiguration('fishreader.showLength')){
			const newConfig = vscode.workspace.getConfiguration('fishreader');
			const newShowLength = newConfig.get<number>('showLength', 20);
			statusBarReader.showLength = newShowLength;
			updateReadingStatus();
		}
		if (
			event.affectsConfiguration('fishreader.writer.previewLength')
			|| event.affectsConfiguration('fishreader.writer.previewTimeout')
		) {
			const newConfig = vscode.workspace.getConfiguration('fishreader');
			statusPresenter.updateOptions({
				previewLength: newConfig.get<number>('writer.previewLength', 20),
				previewTimeoutMs: newConfig.get<number>('writer.previewTimeout', 3000),
			});
		}
	});

 	 // 1. 注册树视图
	const treeView = vscode.window.createTreeView('bookChapters', {
		treeDataProvider: chapterTreeProvider,
		canSelectMany: false // 是否支持多选
	});

  	// 2. 注册刷新命令（对应package.json中的配置）
	const refreshCommand = vscode.commands.registerCommand('fishreader.refresh', () => {
		vscode.window.showInformationMessage('刷新目录');
		// 这里可以重新读取文件并更新provider的数据
		chapterTreeProvider.refresh();
	});

	// 3. 注册点击章节节点的命令
	const openChapterCommand = vscode.commands.registerCommand('fishreader.openChapter', (item: BookTreeItem, parent: BookTreeItem) => {
		if (!modeController.canNavigateReading()) { return; }
		if (parent.chapterData !== statusBarReader.bookData){
			statusBarReader.bookData = parent.chapterData;
		}
		if (item.chapterData?.content) {
			vscode.window.showInformationMessage(`打开章节: ${item.label}`);
			// 在右侧编辑器中打开新文档展示章节内容
			statusBarReader.setChapter(parent.getIndex(item));
			updateReadingStatus();
			if (currentBookPath) {
				context.globalState.update('lastBook', currentBookPath);
				saveProgress(context.globalState, currentBookPath, statusBarReader.getPosition());
			}
		}
	});

	// 注册下一章命令
	const nextChapterCommand = vscode.commands.registerCommand('fishreader.nextChapter', () => {
		if (!modeController.canNavigateReading()) { return; }
		vscode.window.showInformationMessage('下一章');
		statusBarReader.nextChapter();
		updateReadingStatus();
		if (currentBookPath) { saveProgress(context.globalState, currentBookPath, statusBarReader.getPosition()); }
	});
	// 注册上一章命令
	const prevChapterCommand = vscode.commands.registerCommand('fishreader.prevChapter', () => {
		if (!modeController.canNavigateReading()) { return; }
		statusBarReader.prevChapter();
		updateReadingStatus();
		if (currentBookPath) { saveProgress(context.globalState, currentBookPath, statusBarReader.getPosition()); }
	});
	// 注册下一行命令
	const nextLineCommand = vscode.commands.registerCommand('fishreader.nextLine', () => {
		if (!modeController.canNavigateReading()) { return; }
		statusBarReader.nextLine();
		updateReadingStatus();
		if (currentBookPath) { saveProgress(context.globalState, currentBookPath, statusBarReader.getPosition()); }
	});
	// 注册上一行命令
	const prevLineCommand = vscode.commands.registerCommand('fishreader.prevLine', () => {
		if (!modeController.canNavigateReading()) { return; }
		statusBarReader.prevLine();
		updateReadingStatus();
		if (currentBookPath) { saveProgress(context.globalState, currentBookPath, statusBarReader.getPosition()); }
	});
	// 注册显示正文命令
	const showContentCommand = vscode.commands.registerCommand('fishreader.showContent', () => {
		writingController.showStatus();
	});
	// 注册隐藏正文命令
	const hideContentCommand = vscode.commands.registerCommand('fishreader.hideContent', () => {
		writingController.hideStatus();
	});
	// 注册打开书籍命令
	const openBookCommand = vscode.commands.registerCommand('fishreader.openBook', ((item: BookTreeItem, parent: BookTreeItem) => {
		if (!modeController.canNavigateReading()) { return; }
		statusBarReader.bookData = item.chapterData;
		// Track current book path (first content entry is the file path)
		currentBookPath = item.chapterData?.content?.[0];
		if (currentBookPath) {
			context.globalState.update('lastBook', currentBookPath);
		}
		updateReadingStatus();
	}));
	// 选择章节命令
	const selectChapterCommand = vscode.commands.registerCommand('fishreader.selectChapter', () => {
		if (!modeController.canNavigateReading()) { return; }
		vscode.window.showQuickPick(
			statusBarReader.bookData?.children?.map((chapter, index) => ({
				label: chapter.title || `章节 ${index + 1}`,
				index: index
			})) || [],
			{ placeHolder: '选择章节' }
		).then(selected => {
			if (selected) {
				statusBarReader.setChapter(selected.index);
				updateReadingStatus();
				if (currentBookPath) { saveProgress(context.globalState, currentBookPath, statusBarReader.getPosition()); }
			}
		});
	});
	
	// 开始在编辑器里输入文本时，自动隐藏状态栏内容
	const changeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
		if (!modeController.canNavigateReading()) { return; }
		if(!vscode.workspace.getConfiguration('fishreader').get<boolean>("hideWhenInput", false)){ return; }
		const { document } = event;
        
        // 忽略非用户文件的更改（如输出窗口）
        if (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled') {
            return;
        }

		statusPresenter.hide();
	});

	// 切换文本文件焦点时，隐藏状态栏内容
	const changeFocusDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (modeController.mode === 'writing') {
			void writingController.handleActiveEditorChange(editor);
			return;
		}
		if (
			modeController.canNavigateReading()
			&& editor
			&& vscode.workspace.getConfiguration('fishreader').get<boolean>("hideWhenSwitchEditor", true)
		) {
			statusPresenter.hide();
		}
	});

	// 窗口失去焦点时，隐藏状态栏内容
	const changeFocusOutDisposable = vscode.window.onDidChangeWindowState((windowState) => {
		if (modeController.mode === 'writing') {
			void writingController.handleWindowStateChange(windowState);
			return;
		}
		if (!windowState.focused && vscode.workspace.getConfiguration('fishreader').get<boolean>("hideWhenLoseFocus", true)) {
			statusPresenter.hide();
		}
	});

	context.subscriptions.push(
		nextChapterCommand,
		prevChapterCommand,
		nextLineCommand,
		prevLineCommand,
		openBookCommand,
		treeView,
		refreshCommand,
		openChapterCommand,
		showContentCommand,
		hideContentCommand,
		selectChapterCommand,
		configurationDisposable,
		changeDisposable,
		changeFocusDisposable,
		changeFocusOutDisposable
	);
}

export async function deactivate(): Promise<void> {
	await activeWritingController?.shutdown();
	activeWritingController = undefined;
}
