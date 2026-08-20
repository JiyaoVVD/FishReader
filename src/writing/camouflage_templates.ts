import { splitGraphemes } from './grapheme_utils';

const TEMPLATE_MAP: Readonly<Record<string, readonly string[]>> = {
	typescript: [
		'// TODO: validate cached state before restoring',
		'const result = await cache.load(currentPath);',
		'if (!result) { return createDefaultState(); }',
	],
	javascript: [
		'// TODO: verify the current implementation',
		'const result = await cache.load(currentPath);',
		'return result ?? createDefaultState();',
	],
	python: [
		'# TODO: validate cached state before restoring',
		'result = cache.load(current_path)',
		'return result or create_default_state()',
	],
	lua: [
		'-- TODO: validate cached state before restoring',
		'local result = cache:load(current_path)',
		'return result or create_default_state()',
	],
	markdown: [
		'<!-- TODO: review this section before publishing -->',
		'<!-- Verify links and examples in this section -->',
	],
	json: [
		'"status": "pending",',
		'"cacheEnabled": true,',
		'"lastUpdated": "2026-08-20"',
	],
	generic: [
		'// TODO: verify the current implementation',
		'// Review edge cases before submitting this change',
	],
};

function normalizeLanguageId(languageId: string): string {
	switch (languageId.toLowerCase()) {
		case 'typescriptreact':
			return 'typescript';
		case 'javascriptreact':
			return 'javascript';
		default:
			return languageId.toLowerCase();
	}
}

export interface CamouflageRender {
	text: string;
	templateIndex: number;
}

export class CamouflageTemplateProvider {
	getTemplates(languageId: string): readonly string[] {
		return TEMPLATE_MAP[normalizeLanguageId(languageId)] ?? TEMPLATE_MAP.generic;
	}

	render(languageId: string, startTemplateIndex: number, graphemeCount: number): CamouflageRender {
		const templates = this.getTemplates(languageId);
		let templateIndex = ((startTemplateIndex % templates.length) + templates.length) % templates.length;
		let remaining = Math.max(0, graphemeCount);

		while (remaining > 0) {
			const graphemes = splitGraphemes(templates[templateIndex]);
			if (remaining <= graphemes.length) {
				return { text: graphemes.slice(0, remaining).join(''), templateIndex };
			}
			remaining -= graphemes.length;
			templateIndex = (templateIndex + 1) % templates.length;
		}

		return { text: '', templateIndex };
	}

	nextTemplateIndex(languageId: string, currentTemplateIndex: number): number {
		const templates = this.getTemplates(languageId);
		return (currentTemplateIndex + 1) % templates.length;
	}
}
