import * as vscode from 'vscode';
import {BookContentTree} from './book_content_tree';
import {readBook as readTxtBook} from './txt';
import { getFileName } from './common_utils';

let fs = vscode.workspace.fs;

export async function loadNovelDir(dirPath: vscode.Uri): Promise<BookContentTree>{
	let items = await fs.readDirectory(dirPath);
	let children: BookContentTree[] = [];
	await items.forEach(async ([name, type]) => {
		if(type === vscode.FileType.Directory){													
			children.push(await loadNovelDir(vscode.Uri.joinPath(dirPath, name)));
		}
		else if(type === vscode.FileType.File){
			// 等到实际点开书的时候再去读取内容
			// 内容里存一下路径方便后续获取
			children.push({title: getFileName(vscode.Uri.joinPath(dirPath, name)), type: 'book', content: [dirPath.path + "/" + name]});
			// if(name.endsWith(".txt")){
			// 	let fileUri = vscode.Uri.joinPath(dirPath, name);
			// 	let bookData = await readTxtBook(fileUri);
			// 	children.push(bookData);
			// }
		}
	});
	return {title: dirPath.path, type: 'directory', children: children};
}

export async function loadNovelFile(filePath: vscode.Uri, root?: BookContentTree): Promise<BookContentTree>{
	let children: BookContentTree[] = [];
	if(filePath.path.endsWith(".txt")){
		children = await readTxtBook(filePath);
	}
	if(root){
		root.children = children;
		return root;
	}else{
		return {
			title: getFileName(filePath),
			type: 'book',
			children: children
		};
	}
}