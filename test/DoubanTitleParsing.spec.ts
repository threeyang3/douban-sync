import DoubanMovieLoadHandler from '../src/org/wanxp/douban/data/handler/DoubanMovieLoadHandler';
import {PersonNameMode} from '../src/org/wanxp/constant/Constsant';

describe('Douban title parsing', () => {
	const handler = new DoubanMovieLoadHandler({} as any);

	it('keeps spaces in an English title from a search result', () => {
		const context = {
			listItem: {title: 'Under the Skin'},
			settings: {personNameMode: PersonNameMode.EN_NAME},
		} as any;
		expect(handler.getTitleNameByMode(
			'中文译名 Under the Skin',
			PersonNameMode.EN_NAME,
			context,
		)).toBe('Under the Skin');
	});

	it('removes a Chinese search title without flattening the English original', () => {
		const context = {
			listItem: {title: '皮囊之下'},
			settings: {personNameMode: PersonNameMode.EN_NAME},
		} as any;
		expect(handler.getTitleNameByMode(
			'皮囊之下 Under the Skin',
			PersonNameMode.EN_NAME,
			context,
		)).toBe('Under the Skin');
	});

	it('keeps internal spaces for a directly parsed English title', () => {
		const context = {
			settings: {personNameMode: PersonNameMode.EN_NAME},
		} as any;
		expect(handler.getTitleNameByMode(
			'Under the Skin',
			PersonNameMode.EN_NAME,
			context,
		)).toBe('Under the Skin');
	});
});
