import {load} from 'cheerio';
import DoubanPageParser from '../src/org/wanxp/utils/DoubanPageParser';

describe('DoubanPageParser', () => {
	it('extracts tags and a labeled comment without relying on sibling order', () => {
		const html = load(`
			<div class="collection-section">
				<div data-field="comment">This is my comment.</div>
				<span>标签: sci-fi classic</span>
			</div>
		`);

		expect(DoubanPageParser.parseUserTags(html)).toEqual(['sci-fi', 'classic']);
		expect(DoubanPageParser.parseUserComment(html)).toBe('This is my comment.');
	});

	it('does not mistake tags, dates or rating text for a comment', () => {
		const html = load(`
			<div id="interest_sect_level">
				<span>2024-06-01</span>
				<span>标签: one two</span>
				<span>力荐</span>
			</div>
		`);

		expect(DoubanPageParser.parseUserTags(html)).toEqual(['one', 'two']);
		expect(DoubanPageParser.parseUserComment(html)).toBe('');
	});

	it('does not leak separately rendered tag values into the short comment', () => {
		const html = load(`
			<div id="interest_sect_level">
				<span>标签:</span>
				<span>science fiction drama</span>
			</div>
		`);

		expect(DoubanPageParser.parseUserTags(html)).toEqual(['science', 'fiction', 'drama']);
		expect(DoubanPageParser.parseUserComment(html)).toBe('');
	});

	it('keeps paragraphs and chooses the longest full summary', () => {
		const html = load(`
			<div id="link-report">
				<div class="intro">
					<p>First paragraph.</p>
					<p>Second paragraph.</p>
				</div>
			</div>
			<span property="v:summary">Short summary.</span>
			<span property="v:summary">A much longer expanded summary.</span>
		`);

		expect(DoubanPageParser.extractText(html, ['#link-report .intro p']))
			.toBe('First paragraph.\n\nSecond paragraph.');
		expect(DoubanPageParser.extractLongestText(html, ['span[property="v:summary"]']))
			.toBe('A much longer expanded summary.');
	});

	it('normalizes whitespace while preserving real line breaks', () => {
		expect(DoubanPageParser.normalizeText('  first\tline \r\n\r\n\r\n second  line  '))
			.toBe('first line\n\nsecond line');
	});
});
