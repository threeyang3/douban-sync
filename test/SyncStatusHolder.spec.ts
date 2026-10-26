import SyncStatusHolder from '../src/org/wanxp/douban/sync/model/SyncStatusHolder';

describe('SyncStatusHolder file ownership cache', () => {
	it('tracks and removes the Douban ID that owns each local path', async () => {
		const app = {
			vault: {
				getMarkdownFiles: () => [
					{path: 'Movies/Under the Skin.md'},
					{path: 'Movies/Other.md'},
				],
			},
			metadataCache: {
				getFileCache: (file: {path: string}) => ({
					frontmatter: file.path.includes('Under')
						? {doubanId: '1234567'}
						: {doubanId: '7654321'},
				}),
			},
		};
		const status = new SyncStatusHolder({dataFilePath: 'Movies'} as any, app as any);

		await status.buildExistingFilesCache('Movies');

		expect(status.getDoubanIdForFilePath('/Movies/Under the Skin.md')).toBe('1234567');
		expect(status.getExistingFilePath('1234567')).toBe('Movies/Under the Skin.md');
		status.removeFromExistingCache('1234567');
		expect(status.getDoubanIdForFilePath('Movies/Under the Skin.md')).toBeNull();
	});

	it('keeps the failure stage and readable reason in the sync report data', () => {
		const status = new SyncStatusHolder({} as any, {} as any);

		status.fail('1234567', '', '页面检查失败：豆瓣要求完成人机验证，请完成验证后重试');

		expect(status.syncResultMap.get('1234567')).toMatchObject({
			id: '1234567',
			status: 'fail',
			detailMsg: '页面检查失败：豆瓣要求完成人机验证，请完成验证后重试',
		});
	});
});
