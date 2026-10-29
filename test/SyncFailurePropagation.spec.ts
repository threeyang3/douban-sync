import {Notice} from 'obsidian';
import SyncHandler from '../src/org/wanxp/douban/sync/handler/SyncHandler';
import SyncStatusHolder from '../src/org/wanxp/douban/sync/model/SyncStatusHolder';
import DoubanPlugin from '../src/org/wanxp/main';
import DoubanAbstractListHandler from '../src/org/wanxp/douban/sync/handler/list/DoubanAbstractListHandler';
import {DoubanHttpUtil} from '../src/org/wanxp/utils/DoubanHttpUtil';
import {SyncType, SyncConditionType} from '../src/org/wanxp/constant/Constsant';

jest.mock('obsidian', () => new Proxy({
	...jest.requireActual('./mocks/obsidian'), Notice: jest.fn(),
	moment: Object.assign(() => ({format: () => '20261030'}), {locale: () => 'en'}),
}, {get: (target, key) => key in target ? target[key] : class {}}));

function fixture(cancelled = false) {
	const config = {syncType: SyncType.movie, scope: 'collect', syncConditionType: SyncConditionType.ALL, dataFilePath: 'movies'};
	const app = {vault: {getMarkdownFiles: (): any[] => []}};
	const status = new SyncStatusHolder(config as any, app as any);
	const plugin = {app, statusHolder: {syncing: () => !cancelled},
		fileHandler: {getTmpPath: () => '.tmp', writeTextFile: jest.fn(async (_path: string, _text: string) => {}), createNewNoteWithData: jest.fn(async (_path: string, _text: string) => true)}};
	const context = {plugin, syncConfig: config, syncStatusHolder: {syncStatus: status}};
	return {status, plugin, context, handler: new SyncHandler(app as any, plugin as any, config as any, context as any)};
}

describe('sync failure propagation', () => {
	afterEach(() => jest.restoreAllMocks());

	it('rejects list fetch errors instead of returning a normal empty page', async () => {
		jest.spyOn(DoubanHttpUtil, 'httpRequestGet').mockRejectedValue(new Error('network unavailable'));
		const list = DoubanAbstractListHandler.create(SyncType.movie, 'collect') as DoubanAbstractListHandler;
		const context = {plugin: {settingsManager: {getHeaders: () => ({})}, statusHolder: {syncStatus: {setMessage: jest.fn()}}}};
		await expect(list.getPageList('https://movie.douban.com/', context as any)).rejects.toThrow('network unavailable');
	});

	it.each([false, true])('reports a failed page with partial=%s in JSON and Markdown', async partial => {
		const f = fixture();
		if (partial) f.status.create('123', 'Demo', 'movies/Demo.md');
		(f.handler as any).syncHandlers = [{support: () => true, sync: async () => { throw new Error('page 2 failed'); }}];
		const outcome = await f.handler.sync();
		expect(outcome).toBe(partial ? 'partial' : 'failed');
		const report = JSON.parse(f.plugin.fileHandler.writeTextFile.mock.calls[0][1]);
		expect(report).toMatchObject({outcome, errors: ['page 2 failed']});
		const markdown = f.plugin.fileHandler.createNewNoteWithData.mock.calls[0][1];
		expect(markdown).toContain(partial ? 'Sync partially completed' : 'Sync failed');
	});

	it('distinguishes cancellation from a normal empty successful result', async () => {
		for (const cancelled of [true, false]) {
			const f = fixture(cancelled);
			(f.handler as any).syncHandlers = [{support: () => true, sync: async () => {}}];
			expect(await f.handler.sync()).toBe(cancelled ? 'cancelled' : 'success');
		}
	});

	it('does not show a completion notification when the sync failed', async () => {
		const f = fixture();
		const plugin = Object.assign(Object.create(DoubanPlugin.prototype), f.plugin, {
			checkLogin: async () => true, showStatus: jest.fn(), clearStatusBarDelay: jest.fn(),
		});
		plugin.statusHolder.completeSync = jest.fn(async () => {});
		const context = {...f.context, plugin, syncStatusHolder: {...f.context.syncStatusHolder, initHandledData: jest.fn()}};
		jest.spyOn(SyncHandler.prototype, 'sync').mockResolvedValue('failed');
		(Notice as unknown as jest.Mock).mockClear();
		await plugin.sync(context);
		const notices = (Notice as unknown as jest.Mock).mock.calls.map(call => call[0]);
		expect(notices).toContain('Sync failed; see errors in the sync report');
		expect(notices).not.toContain('Sync completed');
		expect(plugin.statusHolder.completeSync).toHaveBeenCalled();
	});
});
