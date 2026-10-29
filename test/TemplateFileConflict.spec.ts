import {saveTemplateIfUnchanged} from '../src/org/wanxp/douban/setting/TemplateSettingHelper';

jest.mock('obsidian', () => new Proxy(jest.requireActual('./mocks/obsidian'), {
	get: (target, key) => key in target ? target[key] : class {},
}));

describe('template file save conflict', () => {
	it('rejects a save if another editor changed the file after it was opened', async () => {
		let stored = 'external edit';
		const app = {vault: {process: async (_file: unknown, update: (text: string) => string) => { stored = update(stored); }}};
		await expect(saveTemplateIfUnchanged(app as any, {} as any, 'original', 'plugin edit')).rejects.toThrow();
		expect(stored).toBe('external edit');
	});

	it('saves when the source still matches the opened content', async () => {
		let stored = 'original';
		const app = {vault: {process: async (_file: unknown, update: (text: string) => string) => { stored = update(stored); }}};
		await saveTemplateIfUnchanged(app as any, {} as any, 'original', 'plugin edit');
		expect(stored).toBe('plugin edit');
	});
});
