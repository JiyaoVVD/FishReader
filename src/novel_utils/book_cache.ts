import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { BookContentTree } from './book_content_tree';

let fs = vscode.workspace.fs;

interface BookCacheData {
	filePath: string;
	fileSize: number;
	mtime: number;
	bookData: BookContentTree[];
}

let _cacheDir: vscode.Uri | undefined;

export function initCacheDir(globalStorageUri: vscode.Uri): void {
	_cacheDir = vscode.Uri.joinPath(globalStorageUri, 'book-cache');
}

export function hashPath(filePath: string): string {
	return crypto.createHash('md5').update(filePath).digest('hex');
}

function getCacheFileUri(filePath: string): vscode.Uri | undefined {
	if (!_cacheDir) {
		return undefined;
	}
	return vscode.Uri.joinPath(_cacheDir, `${hashPath(filePath)}.json`);
}

export async function loadFromCache(filePath: string, fileSize: number, mtime: number): Promise<BookContentTree[] | undefined> {
	const cacheUri = getCacheFileUri(filePath);
	if (!cacheUri) {
		return undefined;
	}
	try {
		const data = await fs.readFile(cacheUri);
		const cached: BookCacheData = JSON.parse(Buffer.from(data).toString('utf8'));
		if (cached.filePath === filePath && cached.fileSize === fileSize && cached.mtime === mtime) {
			return cached.bookData;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

export async function saveToCache(filePath: string, fileSize: number, mtime: number, bookData: BookContentTree[]): Promise<void> {
	const cacheUri = getCacheFileUri(filePath);
	if (!cacheUri) {
		return;
	}
	const cacheData: BookCacheData = { filePath, fileSize, mtime, bookData };
	const content = Buffer.from(JSON.stringify(cacheData), 'utf8');
	try {
		await fs.createDirectory(_cacheDir!);
	} catch {
		// directory may already exist
	}
	await fs.writeFile(cacheUri, content);
}
