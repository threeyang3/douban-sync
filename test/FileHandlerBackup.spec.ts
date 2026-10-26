import FileHandler from '../src/org/wanxp/file/FileHandler';

jest.mock('obsidian', () => ({...jest.requireActual('./mocks/obsidian'), Platform: {isIosApp: false}}));

describe('hidden backup recovery', () => {
	it.each(['Templates/book.md', 'reports/result.json', 'README'])('writes the exact filename %s without adding an extension', async path => {
		const vault = {adapter: {exists: jest.fn(async () => false), mkdir: jest.fn(async () => {})},
			getRoot: () => ({path: ''}), create: jest.fn(async () => {})};
		await new FileHandler({vault} as any).writeTextFile(path, 'test');
		expect(vault.create).toHaveBeenCalledWith(path, 'test');
	});

	it('restores a backup through the adapter when it is not indexed as a TFile', async () => {
		const adapter = {exists: jest.fn(async () => true), read: jest.fn(async () => 'original content'), write: jest.fn(async () => {})};
		const handler = new FileHandler({vault: {adapter, getAbstractFileByPath: (): null => null, getRoot: () => ({path: ''})}} as any);
		await handler.restoreMarkdownFile('movie/demo.md', '.tmp/backups/demo.bak.md');
		expect(adapter.read).toHaveBeenCalledWith('.tmp/backups/demo.bak.md');
		expect(adapter.write).toHaveBeenCalledWith('movie/demo.md', 'original content');
	});
});
