import DoubanUrlUtil from '../src/org/wanxp/utils/DoubanUrlUtil';
import DoubanPageTypeDetector from '../src/org/wanxp/utils/DoubanPageTypeDetector';
import {SupportType} from '../src/org/wanxp/constant/Constsant';

describe('Douban batch URL parsing', () => {
	it.each([
		['https://book.douban.com/subject/1234567/', SupportType.book],
		['https://music.douban.com/subject/1234568/', SupportType.music],
		['https://movie.douban.com/subject/1234569/', SupportType.movie],
		['https://www.douban.com/note/1234570/', SupportType.note],
		['https://www.douban.com/game/1234571/', SupportType.game],
		['https://www.douban.com/location/drama/1234572/', SupportType.theater],
	])('parses %s', (url, type) => {
		expect(DoubanUrlUtil.parse(url)).toMatchObject({type, url: url.replace('http:', 'https:')});
	});

	it('unwraps Douban search redirect links', () => {
		const wrapped = 'https://www.douban.com/link2/?url=https%3A%2F%2Fbook.douban.com%2Fsubject%2F1234567%2F';
		expect(DoubanUrlUtil.parse(wrapped)).toMatchObject({
			id: '1234567',
			type: SupportType.book,
		});
	});

	it('reports invalid and duplicate lines while keeping first occurrences', () => {
		const result = DoubanUrlUtil.parseLines([
			'https://book.douban.com/subject/1234567/',
			'https://book.douban.com/subject/1234567/?from=search',
			'not a url',
			'https://example.com/subject/1234567/',
		]);

		expect(result.items).toHaveLength(1);
		expect(result.duplicates).toHaveLength(1);
		expect(result.invalid).toHaveLength(2);
	});

	it('detects TV pages and preserves fallback types', () => {
		const html = `
			<script type="application/ld+json">{"@type":"TVSeries"}</script>
			<div id="info"><span class="pl">集数:</span><span>12</span></div>`;

		expect(DoubanPageTypeDetector.detect(html)).toBe(SupportType.teleplay);
		expect(DoubanPageTypeDetector.detect('<html><body></body></html>', SupportType.note))
			.toBe(SupportType.note);
	});
});
