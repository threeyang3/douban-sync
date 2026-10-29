import {TFile} from 'obsidian';
import FileHandler from '../src/org/wanxp/file/FileHandler';
import NetFileHandler from '../src/org/wanxp/net/NetFileHandler';
import HttpUtil from '../src/org/wanxp/utils/HttpUtil';

jest.mock('obsidian', () => new Proxy({...jest.requireActual('./mocks/obsidian'), Platform: {isIosApp: false}}, {
	get: (target, key) => key in target ? target[key] : class {},
}));

const binary = (value: number) => new Uint8Array([value]).buffer;
const context = {plugin: {settingsManager: {}}} as any;

describe('attachment write completion and recovery', () => {
	beforeEach(() => jest.spyOn(HttpUtil, 'httpRequestBuffer').mockResolvedValue({status: 200, textArrayBuffer: binary(2)} as any));
	afterEach(() => jest.restoreAllMocks());

	it('does not report success before the write finishes', async () => {
		let finish: () => void;
		const writer = {creatAttachmentWithData: jest.fn(() => new Promise<void>(resolve => { finish = resolve; }))};
		let completed = false;
		const download = new NetFileHandler(writer as any).downloadDBFile('https://example.com/a.jpg', 'covers', 'a.jpg', context, false)
			.then(result => { completed = true; return result; });
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(writer.creatAttachmentWithData).toHaveBeenCalled();
		expect(completed).toBe(false);
		finish();
		expect(await download).toMatchObject({success: true, filepath: 'covers/a.jpg'});
	});

	it('returns a structured failure when creating an attachment fails', async () => {
		const vault = {adapter: {exists: async () => true}, getAbstractFileByPath: (): null => null,
			createBinary: jest.fn(async () => { throw new Error('disk full'); })};
		// The file does not exist; the folder already does.
		vault.adapter.exists = async (path?: string) => path !== 'covers/a.jpg';
		(vault as any).getRoot = () => ({path: ''});
		const writer = new FileHandler({vault} as any);
		const result = await new NetFileHandler(writer).downloadDBFile('https://example.com/a.jpg', 'covers', 'a.jpg', context, false);
		expect(result).toMatchObject({success: false, filepath: null});
		expect(result.error).toContain('disk full');
	});

	it('restores the original bytes after a partial overwrite failure without deleting the file', async () => {
		let stored = binary(1);
		const file = Object.assign(new TFile(), {path: 'covers/a.jpg'});
		const remove = jest.fn();
		let writes = 0;
		const vault = {adapter: {exists: async () => true, remove}, getAbstractFileByPath: () => file,
			readBinary: async () => stored,
			modifyBinary: jest.fn(async (_file, data: ArrayBuffer) => {
				stored = data;
				if (++writes === 1) throw new Error('partial write');
			})};
		const result = await new NetFileHandler(new FileHandler({vault} as any))
			.downloadDBFile('https://example.com/a.jpg', 'covers', 'a.jpg', context, false, {}, true);
		expect(result.success).toBe(false);
		expect(Array.from(new Uint8Array(stored))).toEqual([1]);
		expect(remove).not.toHaveBeenCalled();
	});

	it('propagates binary write errors to direct callers', async () => {
		const vault = {adapter: {exists: async () => false}, createBinary: async () => { throw new Error('write failed'); }};
		await expect(new FileHandler({vault} as any).creatAttachmentWithData('a.jpg', binary(1))).rejects.toThrow('write failed');
	});
});
