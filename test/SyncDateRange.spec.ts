import {DoubanAbstractSyncHandler} from '../src/org/wanxp/douban/sync/handler/DoubanAbstractSyncHandler';
import {PAGE_SIZE, SyncType, SyncConditionType} from '../src/org/wanxp/constant/Constsant';
import {SearchPageTypeOf} from '../src/org/wanxp/douban/data/model/SearchPageTypeOf';
import SyncStatusHolder from '../src/org/wanxp/douban/sync/model/SyncStatusHolder';
import DoubanAbstractListHandler from '../src/org/wanxp/douban/sync/handler/list/DoubanAbstractListHandler';
import {load} from 'cheerio';

jest.mock('../src/org/wanxp/utils/TimeUtil', () => ({sleepRange: async () => {}}));

class Handler extends DoubanAbstractSyncHandler<any> {
	getSyncType() { return SyncType.movie; }
}

function fixture(pages: any[][], total = pages.length * PAGE_SIZE) {
	const offsets: number[] = [];
	const handler = new Handler({} as any, {} as any, [{
		support: () => true,
		getPageData: async (context: any) => {
			offsets.push(context.syncOffset);
			return new SearchPageTypeOf(total, offsets.length, PAGE_SIZE, null, pages[context.syncOffset / PAGE_SIZE] || []);
		},
	}]);
	return {handler, offsets};
}
const item = (id: string, date: string) => ({id, updateDate: new Date(date)});
const context = () => ({syncPreviewMode: true, syncOffset: 999} as any);

describe('date range pagination', () => {
	it('handles the first page before requesting the next and honors cancellation', async () => {
		const events: string[] = [];
		let running = true;
		const config = {syncConditionType: SyncConditionType.ALL, incrementalUpdate: false};
		const app = {vault: {getMarkdownFiles: (): any[] => []}};
		const status = new SyncStatusHolder(config as any, app as any);
		const plugin = {statusHolder: {syncing: () => running}};
		const handler = new Handler(plugin as any, {handle: async (id: string) => {
			events.push('handle ' + id);
			running = false;
		}} as any, [{support: () => true, getPageData: async () => {
			events.push('request');
			return new SearchPageTypeOf(2 * PAGE_SIZE, 1, PAGE_SIZE, null, [item('1', '2024-01-01')]);
		}}]);
		await handler.sync(config as any, {plugin, syncConfig: config, syncStatusHolder: {syncStatus: status}} as any);
		expect(events).toEqual(['request', 'handle 1']);
	});

	it.each(['<a>Missing URL</a>', '<a href="https://movie.douban.com/subject/no-id/">Missing ID</a>'])('filters invalid list links at the parsing boundary: %s', invalid => {
		const handler = DoubanAbstractListHandler.create(SyncType.movie, 'collect') as DoubanAbstractListHandler;
		const page = handler.parseSubjectFromHtml(load(`<div class="item-show"><div class="title">${invalid}</div></div><div class="item-show"><div class="title"><a href="https://movie.douban.com/subject/1234567/">Demo</a></div></div>`), {syncOffset: 0} as any);
		expect(page.list.map(i => i.id)).toEqual(['1234567']);
	});

	it('distinguishes a changed list structure from a recognized empty list', () => {
		const handler = DoubanAbstractListHandler.create(SyncType.movie, 'collect') as DoubanAbstractListHandler;
		expect(() => handler.parseSubjectFromHtml(load('<div class="new-layout">Unknown</div>'), {syncOffset: 0} as any)).toThrow('Unrecognized');
		expect(handler.parseSubjectFromHtml(load('<span class="subject-num">0 / 0</span>'), {syncOffset: 0} as any).list).toEqual([]);
	});
	it('sets fixed offsets, includes both boundaries and excludes invalid dates and duplicate IDs', async () => {
		const f = fixture([
			[item('1', '2024-01-04'), item('2', '2024-01-03'), null],
			[item('2', '2024-01-03'), item('3', '2024-01-02'), item('bad', 'invalid')],
			[item('4', '2024-01-01')],
		], 2 * PAGE_SIZE + 1);
		const result = await f.handler.getByTimeLimit({syncConditionDateFromValue: new Date('2024-01-02'),
			syncConditionDateToValue: new Date('2024-01-03')} as any, context());
		expect(result.map(i => i.id)).toEqual(['2', '3']);
		expect(f.offsets).toEqual([0, PAGE_SIZE, PAGE_SIZE * 2]);
	});
	it('filters a single page and does not request an extra page for exact multiples', async () => {
		const f = fixture([[item('1', '2024-01-01'), item('2', '2024-01-02')]], PAGE_SIZE);
		const result = await f.handler.getByTimeLimit({syncConditionDateToValue: new Date('2024-01-01')} as any, context());
		expect(result.map(i => i.id)).toEqual(['1']);
		expect(f.offsets).toEqual([0]);
	});
	it('stops on an empty page and supports a missing upper boundary', async () => {
		const f = fixture([[item('1', '2024-01-01')], [], [item('2', '2024-01-02')]]);
		const result = await f.handler.getByTimeLimit({syncConditionDateFromValue: new Date('2024-01-01')} as any, context());
		expect(result.map(i => i.id)).toEqual(['1']);
		expect(f.offsets).toEqual([0, PAGE_SIZE]);
	});
});
