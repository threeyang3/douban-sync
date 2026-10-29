import {load} from 'cheerio';
import DoubanBookLoadHandler from '../src/org/wanxp/douban/data/handler/DoubanBookLoadHandler';

describe('Douban template variables', () => {
	it('uses different cover filenames for different IDs sharing the same title', async () => {
		const handler = new DoubanBookLoadHandler({} as any) as any;
		jest.spyOn(handler, 'parsePartPath').mockImplementation((path: string) => path);
		const save = jest.spyOn(handler, 'handleImage').mockImplementation(async (_url, folder, name) => ({success: true, filepath: folder + '/' + name}));
		const context = {settings: {cacheImage: true, attachmentPath: 'covers', attachmentFileName: 'Demo'},
			plugin: {app: {vault: {getAbstractFileByPath: (): null => null}}, settingsManager: {getHeaders: () => ({})}},
			userComponent: {isLogin: () => false}};
		await handler.saveImage({id: '123', image: 'https://example.com/a.jpg'}, context, new Map());
		await handler.saveImage({id: '456', image: 'https://example.com/b.jpg'}, context, new Map());
		expect(save.mock.calls.map(call => call[2])).toEqual(['Demo (123).jpg', 'Demo (456).jpg']);
	});
	it('exposes the local image basename', () => {
		const handler = new DoubanBookLoadHandler({} as any);
		const variableMap = new Map<string, any>();
		(handler as any).initImageVariableMap({
			image: 'assets/covers/Under the Skin.jpg',
			imageUrl: 'https://img.example.com/original.jpg?token=1',
		}, {} as any, variableMap);

		expect(variableMap.get('imageName').value).toBe('Under the Skin.jpg');
	});

	it('extracts at most five unique popular book comments', () => {
		const handler = new DoubanBookLoadHandler({} as any);
		const html = load(`
			<html><head>
				<meta property="og:image" content="https://img.example.com/book.jpg">
				<script type="application/ld+json">
					{"name":"Book","url":"https://book.douban.com/subject/1234567/","author":[{"name":"Author"}],"isbn":"9780000000000"}
				</script>
			</head><body>
				<div id="info"></div>
				<div class="comment-item"><span class="short">comment one</span></div>
				<div class="comment-item"><span class="short">comment two</span></div>
				<div class="comment-item"><span class="short">comment two</span></div>
				<div class="comment-item"><span class="short">comment three</span></div>
				<div class="comment-item"><span class="short">comment four</span></div>
				<div class="comment-item"><span class="short">comment five</span></div>
				<div class="comment-item"><span class="short">comment six</span></div>
			</body></html>
		`);

		const result = handler.parseSubjectFromHtml(html, {} as any);
		expect(result.popularComments).toEqual([
			'comment one',
			'comment two',
			'comment three',
			'comment four',
			'comment five',
		]);
	});
});
