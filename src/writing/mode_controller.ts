import { FishReaderMode } from './writing_types';

export class ModeController {
	private currentMode: FishReaderMode = 'reading';
	private writingSurfaceVisible = false;

	get mode(): FishReaderMode {
		return this.currentMode;
	}

	get isWritingSurfaceVisible(): boolean {
		return this.writingSurfaceVisible;
	}

	startWriting(): void {
		this.currentMode = 'writing';
		this.writingSurfaceVisible = true;
	}

	resumeWriting(): void {
		this.currentMode = 'writing';
		this.writingSurfaceVisible = true;
	}

	hideWritingPresentation(): void {
		if (this.currentMode === 'writing') {
			this.writingSurfaceVisible = false;
		}
	}

	exitWriting(): void {
		this.currentMode = 'reading';
		this.writingSurfaceVisible = false;
	}

	canNavigateReading(): boolean {
		return this.currentMode === 'reading';
	}
}
