import DoubanPlugin from '../src/org/wanxp/main';

jest.mock('obsidian', () => new Proxy(jest.requireActual('./mocks/obsidian'), {
	get: (target, key) => key in target ? target[key] : class {},
}));

describe('force sync filename collisions', () => {
	it('does not overwrite another subject even when the ID-suffixed filename is occupied', async () => {
		const owners = new Map([['movie/Demo.md', '111'], ['movie/Demo (222).md', '333']]);
		const plugin = Object.create(DoubanPlugin.prototype) as DoubanPlugin;
		plugin.app = {vault: {adapter: {exists: async (path: string) => owners.has(path)}}} as any;
		plugin.settings = {syncBackupBeforeReplace: false} as any;
		plugin.fileHandler = {createOrReplaceNewNoteWithData: jest.fn(async () => false)} as any;
		const status = {syncConfig: {force: true}, getDoubanIdForFilePath: (path: string) => owners.get(path), getExistingFilePath: (): null => null, create: jest.fn()};
		const result = await plugin.createFile({action: 'Sync', syncStatusHolder: {syncStatus: status}} as any,
			{filePath: 'movie', fileName: 'Demo', content: 'new content', subject: {id: '222', title: 'Demo'}} as any);
		expect(result).toBe(true);
		expect(plugin.fileHandler.createOrReplaceNewNoteWithData).toHaveBeenCalledWith('movie/Demo (222) (2)', 'new content', undefined);
	});
});
