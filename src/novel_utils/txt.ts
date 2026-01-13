import * as vscode from 'vscode'
import { getFileName } from './common_utils';
import { BookContentTree } from './book_content_tree';
import { readFileWithAutoEncoding } from './encoding_utils';

const chapterReg = /.*(第[\d一二三四五六七八九十]+章|楔子|序章|引子)\s*(.*)/;

let fs = vscode.workspace.fs;

export async function readRawTxt(fileUri: vscode.Uri): Promise<string>{
	let buffer = await fs.readFile(fileUri);
	let { content, encoding, confidence } = await readFileWithAutoEncoding(buffer);
	return content;
}


export async function readBook(fileUri: vscode.Uri): Promise<BookContentTree[]> {
    const rawContent: string = await readRawTxt(fileUri);
    if (!rawContent.trim()) {
        return [];
    }

    const lines = rawContent.split(/\r?\n/);
    const chapters: BookContentTree[] = [];
    let currentChapter: BookContentTree | null = {title: "header", type: 'chapter'};
	chapters.push(currentChapter);
    let contentBuffer: string[] = [];
    
    for (const line of lines) {
        const match = line.match(chapterReg);
        
        if (match) {
            // 保存前一章内容
            if (currentChapter) {
                currentChapter.content = contentBuffer;
                contentBuffer = [];
            }

            // 创建新章节
            currentChapter = {
                title: `${match[1]} ${match[2]}`.trim(),
				type: 'chapter',
            };
            chapters.push(currentChapter);
        } else if (currentChapter) {
            // 添加到当前章节内容
            contentBuffer.push(line);
        }
    }

    // 处理最后一章内容
    if (currentChapter && contentBuffer.length > 0) {
        currentChapter.content = contentBuffer;
    }

    // 如果没有找到章节，将整个内容作为一章
    if (chapters.length === 0) {
        return [{
            title: "unnamed",
			type: 'chapter',
            content: rawContent.split(/\r?\n/),
            children: []
        }];
    }
    
    return chapters;
}
