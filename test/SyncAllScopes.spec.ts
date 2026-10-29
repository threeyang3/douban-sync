import {DoubanMovieSyncHandler} from '../src/org/wanxp/douban/sync/handler/DoubanMovieSyncHandler';
import {DoubanBookSyncHandler} from '../src/org/wanxp/douban/sync/handler/DoubanBookSyncHandler';
import {DoubanMusicSyncHandler} from '../src/org/wanxp/douban/sync/handler/DoubanMusicSyncHandler';
import SyncHandler from '../src/org/wanxp/douban/sync/handler/SyncHandler';
import SyncStatusHolder from '../src/org/wanxp/douban/sync/model/SyncStatusHolder';
import {DoubanHttpUtil} from '../src/org/wanxp/utils/DoubanHttpUtil';
import {PAGE_SIZE, SyncConditionType, SyncType} from '../src/org/wanxp/constant/Constsant';
import {ALL} from '../src/org/wanxp/constant/DoubanUserState';

jest.mock('../src/org/wanxp/utils/TimeUtil', () => ({sleepRange: async () => {}}));
jest.mock('obsidian', () => new Proxy({
	...jest.requireActual('./mocks/obsidian'),
	moment: Object.assign(() => ({format: () => '20261030'}), {locale: () => 'en'}),
}, {get: (target, key) => key in target ? target[key] : class {}}));

type TestType = SyncType.movie | SyncType.book | SyncType.music;
const types: TestType[] = [SyncType.movie, SyncType.book, SyncType.music];

function fixture(type: TestType = SyncType.movie) {
	const config = {syncType: type, scope: ALL, syncConditionType: SyncConditionType.ALL,
		dataFilePath: 'items', incrementalUpdate: false, force: false} as any;
	const app = {vault: {getMarkdownFiles: (): any[] => []}};
	const status = new SyncStatusHolder(config, app as any);
	status.initSyncHandledData([]);
	let running = true;
	const plugin = {app, statusHolder: {syncStatus: status, syncing: () => running}, settings: {syncHandledDataArray: [] as any[]},
		settingsManager: {getHeaders: () => ({})},
		fileHandler: {getTmpPath: () => '.tmp', writeTextFile: jest.fn(async () => {}), createNewNoteWithData: jest.fn(async () => true)}};
	const context = {plugin, syncConfig: config, syncStatusHolder: {syncStatus: status}, userComponent: {getUserId: () => 'test-user'}} as any;
	const constructors = {[SyncType.movie]: DoubanMovieSyncHandler, [SyncType.book]: DoubanBookSyncHandler, [SyncType.music]: DoubanMusicSyncHandler};
	const handler = new constructors[type](plugin as any);
	const ids = {collect: Array.from({length: PAGE_SIZE + 1}, (_, i) => String(1000000 + i)), wish: ['1000000', '2000000'], do: ['3000000']};
	let failAt = '';
	let cancelAt = '';
	let missingTotal = false;
	const requests: string[] = [];
	const http = jest.spyOn(DoubanHttpUtil, 'httpRequestGet').mockImplementation(async (url: string) => {
		const parsed = new URL(url);
		const scope = parsed.pathname.split('/').pop() as keyof typeof ids;
		const offset = Number(parsed.searchParams.get('start'));
		const key = `${scope}:${offset}`;
		requests.push(key);
		if (failAt === key) throw new Error('connection reset');
		if (cancelAt === key) running = false;
		const list = ids[scope].slice(offset, offset + PAGE_SIZE);
		return '<html><body>' + (missingTotal ? '' : `<span class="subject-num">${offset + 1}-${offset + list.length} / ${ids[scope].length}</span>`)
			+ list.map(id => `<div class="item-show"><div class="title"><a href="https://${type}.douban.com/subject/${id}/">Title ${id}</a></div><div class="date">2026-10-01</div></div>`).join('') + '</body></html>';
	});
	const load = jest.spyOn((handler as any).doubanSubjectLoadHandler, 'handle').mockImplementation(async (id: string) => {
		status.create(id, 'Title ' + id, `items/${id}.md`);
	});
	const coordinator = new SyncHandler(app as any, plugin as any, config, context);
	(coordinator as any).syncHandlers = [handler];
	return {config, context, handler, coordinator, status, http, load, requests,
		ids,
		fail: (key: string) => { failAt = key; }, cancel: (key: string) => { cancelAt = key; },
		omitTotal: () => { missingTotal = true; }};
}

describe('ALL scope through registered list handlers', () => {
	afterEach(() => jest.restoreAllMocks());

	it.each(types)('previews and executes all three states for %s, with independent pages and deduplication', async type => {
		const f = fixture(type);
		const preview = await f.handler.preview(f.config, f.context);
		expect(preview.total).toBe(PAGE_SIZE + 3);
		expect(preview.createCount).toBe(PAGE_SIZE + 3);
		expect(f.requests).toEqual(['collect:0', `collect:${PAGE_SIZE}`, 'wish:0', 'do:0']);
		expect(f.status.getAllTotal()).toBeUndefined(); // preview does not mutate active progress
		f.requests.length = 0;
		expect(await f.coordinator.sync()).toBe('success');
		expect(f.requests).toEqual(['collect:0', `collect:${PAGE_SIZE}`, 'wish:0', 'do:0']);
		expect(f.load).toHaveBeenCalledTimes(PAGE_SIZE + 3);
		expect(f.status.syncResultMap.has('2000000')).toBe(true);
		expect(f.status.syncResultMap.has('3000000')).toBe(true);
		expect(f.status.getTotal()).toBe(PAGE_SIZE + 3);
		expect(f.status.getHasHandle()).toBe(PAGE_SIZE + 3);
		expect(f.status.getAllTotal()).toBe(PAGE_SIZE + 4);
	});

	it('keeps the selected single state independent of registration order', async () => {
		const f = fixture();
		f.config.scope = 'wish';
		expect(await f.coordinator.sync()).toBe('success');
		expect(f.requests).toEqual(['wish:0']);
		expect(f.status.getHasHandle()).toBe(2);
	});

	it('continues other states after a page request fails and reports partial completion with its scope', async () => {
		const f = fixture();
		f.fail(`collect:${PAGE_SIZE}`);
		expect(await f.coordinator.sync()).toBe('partial');
		expect(f.requests).toEqual(['collect:0', `collect:${PAGE_SIZE}`, 'wish:0', 'do:0']);
		expect(f.status.getHasHandle()).toBe(PAGE_SIZE + 2);
		expect(f.status.errors).toEqual(['Scope collect: connection reset']);
	});

	it('stops without starting another state when cancelled during a page request', async () => {
		const f = fixture();
		f.cancel(`collect:${PAGE_SIZE}`);
		expect(await f.coordinator.sync()).toBe('cancelled');
		expect(f.requests).toEqual(['collect:0', `collect:${PAGE_SIZE}`]);
		expect(f.status.getHasHandle()).toBe(PAGE_SIZE);
	});

	it('rejects incomplete previews and reports pagination parse failures instead of success', async () => {
		const f = fixture();
		f.omitTotal();
		await expect(f.handler.preview(f.config, f.context)).rejects.toThrow('pagination total');
		expect(await f.coordinator.sync()).toBe('failed');
		expect(f.status.errors).toHaveLength(3);
		expect(f.load).not.toHaveBeenCalled();
	});

	it('applies count conditions separately within each state', async () => {
		const f = fixture();
		f.config.syncConditionType = SyncConditionType.CUSTOM_ITEM;
		f.config.syncConditionCountFromValue = 2;
		f.config.syncConditionCountToValue = 2;
		expect((await f.handler.preview(f.config, f.context)).entries.map(entry => entry.id)).toEqual(['1000001', '2000000']);
		expect(await f.coordinator.sync()).toBe('success');
		expect(f.status.getTotal()).toBe(2);
		expect(f.status.getHasHandle()).toBe(2);
	});

	it.each([SyncConditionType.LAST_THIRTY, SyncConditionType.CUSTOM_TIME])('applies %s independently to all states in preview and execution', async condition => {
		const f = fixture();
		f.config.syncConditionType = condition;
		f.config.syncConditionDateFromValue = new Date('2026-10-01');
		f.config.syncConditionDateToValue = new Date('2026-10-01');
		const expected = condition === SyncConditionType.LAST_THIRTY ? PAGE_SIZE + 2 : PAGE_SIZE + 3;
		expect((await f.handler.preview(f.config, f.context)).total).toBe(expected);
		expect(await f.coordinator.sync()).toBe('success');
		expect(f.status.getTotal()).toBe(expected);
		expect(f.status.getHasHandle()).toBe(expected);
	});

	it('continues to other states when the first state is empty', async () => {
		const f = fixture();
		f.ids.collect = [];
		expect(await f.coordinator.sync()).toBe('success');
		expect(f.requests).toEqual(['collect:0', 'wish:0', 'do:0']);
		expect(f.status.getTotal()).toBe(3);
		expect(f.status.getHasHandle()).toBe(3);
	});
});
