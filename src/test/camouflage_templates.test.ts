import * as assert from 'assert';
import { CamouflageTemplateProvider } from '../writing/camouflage_templates';

suite('Camouflage Template Provider', () => {
	const provider = new CamouflageTemplateProvider();

	test('maps supported and React language identifiers', () => {
		assert.ok(provider.getTemplates('typescript')[0].startsWith('//'));
		assert.deepStrictEqual(provider.getTemplates('typescriptreact'), provider.getTemplates('typescript'));
		assert.ok(provider.getTemplates('python')[0].startsWith('#'));
		assert.ok(provider.getTemplates('lua')[0].startsWith('--'));
		assert.ok(provider.getTemplates('markdown')[0].startsWith('<!--'));
		assert.ok(provider.getTemplates('json')[0].startsWith('"'));
	});

	test('uses a generic fallback without real input', () => {
		assert.deepStrictEqual(provider.getTemplates('unknown-language'), provider.getTemplates('generic'));
		assert.ok(!provider.getTemplates('generic').join('\n').includes('真实草稿'));
	});

	test('advances and rotates deterministic one-line templates', () => {
		const first = provider.render('typescript', 0, 5);
		const repeated = provider.render('typescript', 0, 5);
		assert.deepStrictEqual(first, repeated);
		assert.strictEqual(first.text.length, 5);

		const firstLength = provider.getTemplates('typescript')[0].length;
		const rotated = provider.render('typescript', 0, firstLength + 2);
		assert.strictEqual(rotated.templateIndex, 1);
		assert.strictEqual(rotated.text.length, 2);
		assert.ok(!rotated.text.includes('\n'));
	});
});
