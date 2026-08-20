import { CamouflageTemplateProvider } from './camouflage_templates';
import { countDraftCharacters, countGraphemes } from './grapheme_utils';
import { LoadedDraft, SaveState, WriterSnapshot } from './writing_types';

export class WriterSession {
	private committedContent = '';
	private currentSegment = '';
	private languageId: string;
	private templateStartIndex = 0;
	private localRevision = 0;
	private baseRevision: number;
	private saveState: SaveState = 'idle';
	private lastInputSequence = -1;
	private lastAcknowledgedLocalRevision = -1;

	constructor(
		private draft: LoadedDraft,
		languageId: string,
		private readonly templates = new CamouflageTemplateProvider(),
	) {
		this.languageId = languageId || 'generic';
		this.baseRevision = draft.metadata.revision;
		this.loadContent(draft.content);
		this.saveState = 'saved';
	}

	private loadContent(content: string): void {
		const normalized = content.replace(/\r\n?/g, '\n');
		const lastBreak = normalized.lastIndexOf('\n');
		if (lastBreak < 0) {
			this.committedContent = '';
			this.currentSegment = normalized;
			return;
		}
		this.committedContent = normalized.slice(0, lastBreak + 1);
		this.currentSegment = normalized.slice(lastBreak + 1);
	}

	replaceCurrentSegment(value: string, sequence: number): boolean {
		if (sequence <= this.lastInputSequence) {
			return false;
		}
		this.lastInputSequence = sequence;
		const before = this.getFullContent();
		const normalized = value.replace(/\r\n?/g, '\n');
		const lines = normalized.split('\n');
		if (lines.length > 1) {
			this.committedContent += `${lines.slice(0, -1).join('\n')}\n`;
			this.currentSegment = lines.at(-1) ?? '';
		} else {
			this.currentSegment = normalized;
		}
		if (before === this.getFullContent()) {
			return false;
		}
		this.localRevision++;
		this.saveState = 'idle';
		return true;
	}

	submitCurrentSegment(value: string, sequence: number): boolean {
		if (sequence <= this.lastInputSequence) {
			return false;
		}
		this.replaceCurrentSegment(value, sequence);
		const rendered = this.templates.render(
			this.languageId,
			this.templateStartIndex,
			countGraphemes(this.currentSegment),
		);
		this.committedContent += `${this.currentSegment}\n`;
		this.currentSegment = '';
		this.templateStartIndex = this.templates.nextTemplateIndex(this.languageId, rendered.templateIndex);
		this.localRevision++;
		this.saveState = 'idle';
		return true;
	}

	setLanguage(languageId: string): void {
		this.languageId = languageId || 'generic';
		this.templateStartIndex = 0;
	}

	setTitle(title: string): void {
		this.draft.metadata.title = title;
	}

	getFullContent(): string {
		return this.committedContent + this.currentSegment;
	}

	markSaving(requestLocalRevision: number): void {
		if (requestLocalRevision === this.localRevision) {
			this.saveState = 'saving';
		}
	}

	markSaved(requestLocalRevision: number, storedRevision: number): void {
		if (requestLocalRevision < this.lastAcknowledgedLocalRevision) {
			return;
		}
		this.lastAcknowledgedLocalRevision = requestLocalRevision;
		this.baseRevision = storedRevision;
		this.draft.metadata.revision = storedRevision;
		if (requestLocalRevision === this.localRevision) {
			this.saveState = 'saved';
		} else {
			this.saveState = 'idle';
		}
	}

	markSaveFailed(requestLocalRevision: number, conflict = false): void {
		if (requestLocalRevision === this.localRevision) {
			this.saveState = conflict ? 'conflict' : 'error';
		}
	}

	replaceDraft(draft: LoadedDraft, languageId = this.languageId): void {
		this.draft = draft;
		this.languageId = languageId || 'generic';
		this.baseRevision = draft.metadata.revision;
		this.localRevision = 0;
		this.lastInputSequence = -1;
		this.lastAcknowledgedLocalRevision = -1;
		this.templateStartIndex = 0;
		this.loadContent(draft.content);
		this.saveState = 'saved';
	}

	getSnapshot(): WriterSnapshot {
		const decoy = this.templates.render(
			this.languageId,
			this.templateStartIndex,
			countGraphemes(this.currentSegment),
		);
		const fullContent = this.getFullContent();
		return {
			draftId: this.draft.metadata.id,
			title: this.draft.metadata.title,
			languageId: this.languageId,
			committedContent: this.committedContent,
			currentSegment: this.currentSegment,
			fullContent,
			decoyText: decoy.text,
			charCount: countDraftCharacters(fullContent),
			localRevision: this.localRevision,
			baseRevision: this.baseRevision,
			saveState: this.saveState,
			lastInputSequence: this.lastInputSequence,
		};
	}
}
