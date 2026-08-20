import * as assert from 'assert';
import { ModeController } from '../writing/mode_controller';

suite('Writing Mode Controller', () => {
	test('transitions through start, hide, resume, and normal exit', () => {
		const controller = new ModeController();
		assert.strictEqual(controller.mode, 'reading');
		assert.strictEqual(controller.canNavigateReading(), true);

		controller.startWriting();
		assert.strictEqual(controller.mode, 'writing');
		assert.strictEqual(controller.isWritingSurfaceVisible, true);
		assert.strictEqual(controller.canNavigateReading(), false);

		controller.hideWritingPresentation();
		assert.strictEqual(controller.mode, 'writing');
		assert.strictEqual(controller.isWritingSurfaceVisible, false);

		controller.resumeWriting();
		assert.strictEqual(controller.isWritingSurfaceVisible, true);

		controller.exitWriting();
		assert.strictEqual(controller.mode, 'reading');
		assert.strictEqual(controller.canNavigateReading(), true);
	});
});
