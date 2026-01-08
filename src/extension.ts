import * as vscode from 'vscode';
import { readBook, BookContentTree } from './novel_utils/txt';
import {StatusBarReader} from './status_bar_reader';

export class ChapterTreeDataProvider implements vscode.TreeDataProvider<ChapterTreeItem> {
  // 用于树视图刷新的事件触发器[citation:4]
	private _onDidChangeTreeData: vscode.EventEmitter<ChapterTreeItem | undefined | void> = new vscode.EventEmitter();
	readonly onDidChangeTreeData: vscode.Event<ChapterTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	private bookData: BookContentTree | undefined;

	// 刷新整个树视图
	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	// 更新数据源
	updateBookData(newData: BookContentTree): void {
		this.bookData = newData;
		this.refresh(); // 数据更新后触发视图刷新[citation:4]
	}

	// 获取树节点的显示项
	getTreeItem(element: ChapterTreeItem): vscode.TreeItem {
		return element;
	}

	getIndex(element: ChapterTreeItem): number {
		if (!this.bookData) {
			return -1;
		}
		return this.bookData.children?.indexOf(element.chapterData!) || -1;
	}

	// 获取节点的子节点
	async getChildren(element?: ChapterTreeItem): Promise<ChapterTreeItem[]> {
		if (!this.bookData) {
			return [new ChapterTreeItem('暂无内容', vscode.TreeItemCollapsibleState.None)];
		}

		// 如果没有传入element，则是根节点，这里返回书的直接子节点（即章节）
		if (!element) {
			return this.bookData.children?.map(child => 
			new ChapterTreeItem(
				child.title || '未命名章节',
				vscode.TreeItemCollapsibleState.None, // 章节为叶子节点，不可展开
				child // 将数据保存在item中，便于后续点击时获取
			)
			) || [];
		}
		// 如果有element，可以根据element的数据返回其子节点（如果你的数据结构是多层级的）
		return []; // 本例中章节没有子级
	}
}

// 自定义的树节点项
class ChapterTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly chapterData?: BookContentTree // 关联的数据
	) {
		super(label, collapsibleState);
		// 可以为节点设置点击命令
		this.command = {
		  command: 'fishreader.openChapter',
		  title: '打开章节',
		  arguments: [this] // 将节点自身作为参数传递给命令
		};
	}
}

export function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('fishreader');
	const chapterTreeProvider = new ChapterTreeDataProvider();

	const statusBarReader = new StatusBarReader();

	let bookPath = config.get<string>("defaultBookPath", "F:/noveltest/test.txt");
	console.log("Default book path:", bookPath);
	readBook(vscode.Uri.file(bookPath || "")).then(data => {
		chapterTreeProvider.updateBookData(data);
		statusBarReader.bookData = data;
		return data;
	})

	vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration('novelReader.defaultBookPath')) {
			const newConfig = vscode.workspace.getConfiguration('novelReader');
			const newBookPath = newConfig.get<string>('defaultBookPath', 'F:/noveltest/test.txt');
			readBook(vscode.Uri.file(newBookPath || "")).then(data => {
				chapterTreeProvider.updateBookData(data);
				return data;
			});
		}
	});

	// 状态栏显示正文
	const contentStatusBar = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		0
	);

	contentStatusBar.text = "$(book) 这里应该是内容"
	contentStatusBar.tooltip = "正文"

	contentStatusBar.show()

	context.subscriptions.push(contentStatusBar)

 	 // 1. 注册树视图
	const treeView = vscode.window.createTreeView('bookChapters', {
		treeDataProvider: chapterTreeProvider,
		canSelectMany: false // 是否支持多选[citation:4]
	});


  	// 2. 注册刷新命令（对应package.json中的配置）
	const refreshCommand = vscode.commands.registerCommand('fishreader.refresh', () => {
		vscode.window.showInformationMessage('刷新目录');
		// 这里可以重新读取文件并更新provider的数据
		chapterTreeProvider.refresh();
	});

  	// 3. 注册点击章节节点的命令
	const openChapterCommand = vscode.commands.registerCommand('fishreader.openChapter', (item: ChapterTreeItem) => {
		if (item.chapterData?.content) {
			// 在右侧编辑器中打开新文档展示章节内容
			statusBarReader.setChapter(chapterTreeProvider.getIndex(item));
			contentStatusBar.text = `$(book) ${statusBarReader.currentChapterTitle}: ${statusBarReader.showContent}`;
		}
	});

	// 注册下一章命令
	const nextChapterCommand = vscode.commands.registerCommand('fishreader.nextChapter', () => {
		vscode.window.showInformationMessage('下一章');
		statusBarReader.nextChapter();
		contentStatusBar.text = `$(book) ${statusBarReader.currentChapterTitle}: ${statusBarReader.showContent}`;
	})
	// 注册上一章命令
	const prevChapterCommand = vscode.commands.registerCommand('fishreader.prevChapter', () => {
		statusBarReader.prevChapter();
		contentStatusBar.text = `$(book) ${statusBarReader.currentChapterTitle}: ${statusBarReader.showContent}`;
	})
	// 注册下一行命令
	const nextLineCommand = vscode.commands.registerCommand('fishreader.nextLine', () => {
		statusBarReader.nextLine();
		contentStatusBar.text = `$(book) ${statusBarReader.currentChapterTitle}: ${statusBarReader.showContent}`;
	})
	// 注册上一行命令
	const prevLineCommand = vscode.commands.registerCommand('fishreader.prevLine', () => {
		statusBarReader.prevLine();
		contentStatusBar.text = `$(book) ${statusBarReader.currentChapterTitle}: ${statusBarReader.showContent}`;
	})
	// 注册显示正文命令
	const showContentCommand = vscode.commands.registerCommand('fishreader.showContent', () => {
		contentStatusBar.show();
	})
	// 注册隐藏正文命令
	const hideContentCommand = vscode.commands.registerCommand('fishreader.hideContent', () => {
		contentStatusBar.hide();
	})
	
	context.subscriptions.push(nextChapterCommand, prevChapterCommand, nextLineCommand, prevLineCommand);
	context.subscriptions.push(treeView, refreshCommand, openChapterCommand, showContentCommand, hideContentCommand);
}
