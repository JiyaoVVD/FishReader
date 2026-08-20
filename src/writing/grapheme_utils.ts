interface SegmentData {
	segment: string;
}

interface SegmenterLike {
	segment(input: string): Iterable<SegmentData>;
}

interface SegmenterConstructorLike {
	new (locale?: string | string[], options?: { granularity: 'grapheme' }): SegmenterLike;
}

let cachedSegmenter: SegmenterLike | undefined;

function getSegmenter(): SegmenterLike | undefined {
	if (cachedSegmenter) {
		return cachedSegmenter;
	}
	const constructor = (Intl as unknown as { Segmenter?: SegmenterConstructorLike }).Segmenter;
	if (!constructor) {
		return undefined;
	}
	cachedSegmenter = new constructor(undefined, { granularity: 'grapheme' });
	return cachedSegmenter;
}

export function splitGraphemes(value: string): string[] {
	const segmenter = getSegmenter();
	if (!segmenter) {
		return Array.from(value);
	}
	return Array.from(segmenter.segment(value), item => item.segment);
}

export function countGraphemes(value: string): number {
	return splitGraphemes(value).length;
}

export function countDraftCharacters(value: string): number {
	return countGraphemes(value.replace(/\r?\n/g, ''));
}

export function takeLastGraphemes(value: string, limit: number): string {
	if (limit <= 0) {
		return '';
	}
	return splitGraphemes(value).slice(-limit).join('');
}

export function deleteLastGraphemes(value: string, count: number): string {
	if (count <= 0) {
		return value;
	}
	const graphemes = splitGraphemes(value);
	return graphemes.slice(0, Math.max(0, graphemes.length - count)).join('');
}

export function formatPreview(value: string, limit: number): string {
	return takeLastGraphemes(value, limit).replace(/\r?\n/g, '↵');
}
