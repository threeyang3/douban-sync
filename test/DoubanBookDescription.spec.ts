import {load} from 'cheerio';
import DoubanBookLoadHandler from '../src/org/wanxp/douban/data/handler/DoubanBookLoadHandler';

describe('Douban book descriptions', () => {
	const handler = new DoubanBookLoadHandler({} as any);
	const parse = (description: string) => handler.parseSubjectFromHtml(load(`
		<html><head><script type="application/ld+json">{
			"name":"Example book", "url":"https://book.douban.com/subject/1084336/",
			"author":[], "isbn":"9787020042494"
		}</script></head><body>${description}</body></html>
	`), {} as any).desc;

	it('selects the expanded description without the short version or expand control', () => {
		expect(parse(`
			<div class="related_info"><div id="link-report" class="indent">
				<span class="short"><div class="intro">
					<p>Opening paragraph.</p><p>Truncated...</p><p><a>(展开全部)</a></p>
				</div></span>
				<span class="all hidden"><div><div class="intro">
					<p>Opening paragraph.</p><p>The complete second paragraph.</p>
				</div></div></span>
			</div></div>
		`)).toBe('Opening paragraph.\n\nThe complete second paragraph.');
	});

	it('keeps legacy expanded descriptions', () => {
		expect(parse(`
			<div id="link-report"><div class="intro">
				<span class="short">Truncated...</span>
				<span class="all hidden">Full legacy description.</span>
			</div></div>
		`)).toBe('Full legacy description.');
	});

	it('keeps all paragraphs when no collapsed version exists', () => {
		expect(parse(`
			<div id="link-report"><div class="intro">
				<p>First paragraph.</p><p>Second paragraph.</p>
			</div></div>
		`)).toBe('First paragraph.\n\nSecond paragraph.');
	});
});
