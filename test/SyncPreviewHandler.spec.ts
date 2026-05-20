import {DoubanAbstractSyncHandler} from '../src/org/wanxp/douban/sync/handler/DoubanAbstractSyncHandler';
import {SyncConditionType, SyncType} from '../src/org/wanxp/constant/Constsant';
import {SearchPageTypeOf} from '../src/org/wanxp/douban/data/model/SearchPageTypeOf';
import {SupportType} from '../src/org/wanxp/constant/Constsant';
import {SubjectListItem} from '../src/org/wanxp/douban/data/model/SubjectListItem';
import {DoubanListHandler} from '../src/org/wanxp/douban/sync/handler/list/DoubanListHandler';
import {SyncConfig} from '../src/org/wanxp/douban/sync/model/SyncConfig';
import {DoubanSubjectState} from '../src/org/wanxp/constant/DoubanUserState';

class FakeSyncHandler extends DoubanAbstractSyncHandler<any> {
	constructor(plugin: any, items: SubjectListItem[]) {
		const listHandler: DoubanListHandler = {
			support: () => true,
			getPageData: async () => new SearchPageTypeOf(
				items.length,
				1,
				items.length || 1,
				SupportType.movie,
				items,
			),
		};
		super(plugin, {
			parse: async () => {
				throw new Error('not used');
			},
			support: () => true,
			handle: async () => {
				throw new Error('not used');
			},
		}, [listHandler]);
	}

	getSyncType(): SyncType {
		return SyncType.movie;
	}
}

function createConfig(force = false, inheritOldFields = false): SyncConfig {
	return {
		syncType: SyncType.movie,
		syncConditionType: SyncConditionType.LAST_THIRTY,
		syncConditionCountFromValue: 1,
		syncConditionCountToValue: 30,
		syncConditionDateFromValue: new Date('2024-01-01'),
		syncConditionDateToValue: new Date('2024-12-31'),
		scope: DoubanSubjectState.collect,
		force,
		dataFilePath: 'movies',
		dataFileNamePath: '{{title}}',
		cacheImage: false,
		cacheHighQuantityImage: false,
		overwriteCoverImage: false,
		attachmentPath: 'assets',
		attachmentFileName: '{{title}}',
		templateFile: '',
		incrementalUpdate: true,
		inheritOldFields,
	};
}

function createPlugin(markdownFiles: any[], frontmatterByPath: Record<string, Record<string, unknown>>, handledIds: string[] = []) {
	return {
		app: {
			vault: {
				getMarkdownFiles: () => markdownFiles,
			},
			metadataCache: {
				getFileCache: (file: any) => ({ frontmatter: frontmatterByPath[file.path] }),
			},
		},
		settings: {
			dataProtection: {
				preserveCustomProperties: true,
				preserveRecord: true,
				preserveThoughts: false,
			},
			syncBackupBeforeReplace: true,
			syncHandledDataArray: [
				{
					key: `movies+${SyncType.movie}+${DoubanSubjectState.collect}`,
					value: handledIds,
				},
			],
		},
		statusHolder: {},
	};
}

describe('Sync preview', () => {
	it('classifies create, exists and unHandle items in incremental mode', async () => {
		const items: SubjectListItem[] = [
			{ id: '1', title: 'Existing', url: 'https://douban.com/1', updateDate: new Date('2024-01-01') },
			{ id: '2', title: 'Create', url: 'https://douban.com/2', updateDate: new Date('2024-01-02') },
			{ id: '3', title: 'Handled', url: 'https://douban.com/3', updateDate: new Date('2024-01-03') },
		];
		const markdownFiles = [{ path: 'movies/existing.md' }];
		const plugin = createPlugin(markdownFiles, {
			'movies/existing.md': { doubanId: '1' },
		}, ['3']);
		const handler = new FakeSyncHandler(plugin, items);

		const preview = await handler.preview(createConfig(false, false), {
			plugin: plugin as any,
			mode: undefined as never,
			settings: plugin.settings as any,
			userComponent: {} as never,
			netFileHandler: {} as never,
			action: 'SyncPreview',
			syncPreviewMode: true,
		} as any);

		expect(preview.total).toBe(3);
		expect(preview.createCount).toBe(1);
		expect(preview.existsCount).toBe(1);
		expect(preview.unHandleCount).toBe(1);
		expect(preview.replaceCount).toBe(0);
		expect(preview.entries.map((entry) => entry.action)).toEqual(['exists', 'create', 'unHandle']);
	});

	it('classifies replace items and reports inherited data summary when force sync is enabled', async () => {
		const items: SubjectListItem[] = [
			{ id: '4', title: 'Legacy Existing', url: 'https://douban.com/4', updateDate: new Date('2024-01-01') },
			{ id: '5', title: 'Normal Existing', url: 'https://douban.com/5', updateDate: new Date('2024-01-02') },
		];
		const markdownFiles = [
			{ path: 'movies/legacy.md' },
			{ path: 'movies/normal.md' },
		];
		const plugin = createPlugin(markdownFiles, {
			'movies/legacy.md': { id: '4' },
			'movies/normal.md': { doubanId: '5' },
		});
		const handler = new FakeSyncHandler(plugin, items);

		const preview = await handler.preview(createConfig(true, true), {
			plugin: plugin as any,
			mode: undefined as never,
			settings: plugin.settings as any,
			userComponent: {} as never,
			netFileHandler: {} as never,
			action: 'SyncPreview',
			syncPreviewMode: true,
		} as any);

		expect(preview.replaceCount).toBe(2);
		expect(preview.backupEnabled).toBe(true);
		expect(preview.inheritSummary).toEqual(['frontmatter 自定义属性', '## 记录']);
		expect(preview.entries.every((entry) => entry.action === 'replace')).toBe(true);
	});
});
