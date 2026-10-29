import DoubanPlugin from '../src/org/wanxp/main';
import {TFile} from 'obsidian';
import {UserDataExtractor} from '../src/org/wanxp/douban/userdata/UserDataExtractor';
import {UserDataMerger} from '../src/org/wanxp/douban/userdata/UserDataMerger';

jest.mock('obsidian', () => new Proxy(jest.requireActual('./mocks/obsidian'), {
	get: (target, key) => key in target ? target[key] : class {},
}));

describe('force sync filename collisions', () => {
	afterEach(() => jest.restoreAllMocks());

	function replacementFixture() {
		let text = 'original user data';
		const file = Object.assign(new TFile(), {path: 'movie/Demo.md'});
		const plugin = Object.create(DoubanPlugin.prototype) as DoubanPlugin;
		plugin.app = {vault: {adapter: {exists: async () => true},
			getAbstractFileByPath: () => file, read: async () => text,
			modify: jest.fn(async (_file, data) => { text = data; }),
		}} as any;
		plugin.settings = {syncBackupBeforeReplace: false, dataProtection: {}} as any;
		plugin.fileHandler = {createOrReplaceNewNoteWithData: jest.fn(async (_path, data) => { text = data; return true; })} as any;
		const status = {syncConfig: {force: true}, getDoubanIdForFilePath: () => '222',
			getExistingFilePath: () => file.path, replace: jest.fn(), fail: jest.fn()};
		const context = {action: 'Sync', syncConfig: {inheritOldFields: true}, syncStatusHolder: {syncStatus: status}};
		const result = {filePath: 'movie', fileName: 'Demo', content: 'new content', subject: {id: '222', title: 'Demo'}};
		jest.spyOn(UserDataExtractor.prototype, 'extractFromFileAsync').mockResolvedValue({identifier: {doubanId: '222', title: 'Demo', type: 'movie'}});
		return {plugin, status, context, result, text: () => text};
	}

	it('leaves the original untouched if inheritance fails with backups disabled', async () => {
		const f = replacementFixture();
		jest.spyOn(UserDataMerger.prototype, 'mergeUserData').mockImplementation(() => { throw new Error('merge failed'); });
		expect(await f.plugin.createFile(f.context as any, f.result as any)).toBe(false);
		expect(f.text()).toBe('original user data');
		expect(f.plugin.fileHandler.createOrReplaceNewNoteWithData).not.toHaveBeenCalled();
	});

	it('writes the already merged content once', async () => {
		const f = replacementFixture();
		jest.spyOn(UserDataMerger.prototype, 'mergeUserData').mockReturnValue('merged content');
		expect(await f.plugin.createFile(f.context as any, f.result as any)).toBe(true);
		expect(f.text()).toBe('merged content');
		expect(f.plugin.fileHandler.createOrReplaceNewNoteWithData).toHaveBeenCalledTimes(1);
	});

	it('restores original content after a partial write failure with backups disabled', async () => {
		const f = replacementFixture();
		jest.spyOn(UserDataMerger.prototype, 'mergeUserData').mockReturnValue('merged content');
		(f.plugin.fileHandler.createOrReplaceNewNoteWithData as jest.Mock).mockImplementation(async () => {
			await f.plugin.app.vault.modify({} as any, 'partial content');
			throw new Error('write failed');
		});
		expect(await f.plugin.createFile(f.context as any, f.result as any)).toBe(false);
		expect(f.text()).toBe('original user data');
	});
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
