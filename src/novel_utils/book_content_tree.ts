export interface BookContentTree{
	title?: string;
	type?: 'chapter' | 'book' | 'directory';
	content?: string[];
	children?: BookContentTree[];
}