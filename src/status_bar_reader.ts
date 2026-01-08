import {BookContentTree} from './novel_utils/txt';

export class StatusBarReader {
	private showLength: number = 20;
	private _bookData: BookContentTree | undefined;

	private chapterIndex: number = 0;
	private contentIndex: number = 0;
	private lineIndex: number = 0;
	private showContentCache: string | undefined = "";

	constructor(_bookData?: BookContentTree){
		this._bookData = _bookData;
		this.refreshContent();
	}

	get bookData(): BookContentTree | undefined{
		return this._bookData;
	}
	set bookData(value: BookContentTree | undefined){
		this._bookData = value;
		this.chapterIndex = 0;
		this.contentIndex = 0;
		this.lineIndex = 0;
		this.showContentCache = "";
		this.refreshContent();
	}

	get currentChapter(): BookContentTree | undefined{
		if (!this._bookData) {
			return undefined;
		}
		return this._bookData.children?.[this.chapterIndex];
	}

	get currentLine(): string{
		let chapter = this.currentChapter;
		if (!chapter){
			return "";
		}
		return chapter.content?.at(this.lineIndex) || "";
	}

	get currentChapterTitle(): string{
		return this.currentChapter?.title || "无章节";
	}

	get showContent(): string{
		return this.showContentCache || "";
	}

	private refreshContent(): void{
		let line: string = this.currentLine;
		if (!line){
			this.showContentCache = "";
			return;
		}
		let content: string = line.slice(this.contentIndex, this.contentIndex + Math.min(this.showLength, line.length - this.contentIndex)).trim();
		if(this.contentIndex == 0){
			content = "▶ " + content;
		}else{
			content = "-- " + content;
		}
		if(this.contentIndex + this.showLength >= line.length){
			content = content + " ◀";
		}else{
			content = content + " --";
		}
		this.showContentCache = content;
	}

	nextLine(): void{
		let line: string = this.currentLine;
		if(!line){
			return;
		}
		let totalLength: number = line.length || 0;
		if(this.contentIndex + this.showLength >= totalLength){
			if(this.lineIndex < this.currentChapter?.content?.length! - 1){
				this.lineIndex++;
				this.contentIndex = 0;
				this.refreshContent();
			}else{
				this.nextChapter();
			}
		}
		else{
			this.contentIndex += Math.min(this.showLength, totalLength - this.contentIndex);
			this.refreshContent();
		}
	}

	prevLine(): void{
		if(this.contentIndex <= 0){
			if(this.lineIndex > 0){
				this.lineIndex--;
				this.contentIndex = 0;
				this.refreshContent();
			}else{
				this.prevChapter();
			}
		}
		else{
			this.contentIndex -= Math.min(this.showLength, this.contentIndex);
			this.refreshContent();
		}
	}

	nextChapter(): void {
		if (!this._bookData) {
			return;
		}
		if (this.chapterIndex < (this._bookData.children?.length || 0) - 1) {
			this.chapterIndex++;
			this.contentIndex = 0;
			this.lineIndex = 0;
			this.refreshContent();
		}
	}

	prevChapter(): void {
		if (!this._bookData) {
			return;
		}
		if (this.chapterIndex > 0) {
			this.chapterIndex--;
			this.contentIndex = 0;
			this.lineIndex = 0;
			this.refreshContent();
		}
	}

	setChapter(index: number): void{
		if (!this._bookData) {
			return;
		}
		if (index >= 0 && index < (this._bookData.children?.length || 0)) {
			this.chapterIndex = index;
			this.contentIndex = 0;
			this.lineIndex = 0;
			this.refreshContent();
		}
	}
}