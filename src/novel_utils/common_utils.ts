import * as vscode from 'vscode';

export function getFileName(fileUri: vscode.Uri): string{
	let fileName = fileUri.path.split('/').pop();
	return <string>fileName;
}