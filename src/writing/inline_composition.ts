export interface InlineCompositionState {
	value: string;
	cursorOffset: number;
}

export interface InlineCompositionUpdate {
	text: string;
	replacePrevCharCount?: number;
	replaceNextCharCount?: number;
	positionDelta?: number;
}

function normalizeCount(value: number | undefined): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.trunc(value ?? 0));
}

function normalizeDelta(value: number | undefined): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.trunc(value ?? 0);
}

export function startInlineComposition(value: string): InlineCompositionState {
	return { value, cursorOffset: value.length };
}

export function applyInlineCompositionUpdate(
	state: InlineCompositionState,
	update: InlineCompositionUpdate,
): InlineCompositionState {
	const previousCount = normalizeCount(update.replacePrevCharCount);
	const nextCount = normalizeCount(update.replaceNextCharCount);
	const start = Math.max(0, state.cursorOffset - previousCount);
	const end = Math.min(state.value.length, state.cursorOffset + nextCount);
	const value = state.value.slice(0, start) + update.text + state.value.slice(end);
	const cursorOffset = Math.max(
		0,
		Math.min(value.length, start + update.text.length + normalizeDelta(update.positionDelta)),
	);
	return { value, cursorOffset };
}
