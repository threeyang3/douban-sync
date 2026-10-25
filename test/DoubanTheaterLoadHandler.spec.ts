import {load} from 'cheerio';
import DoubanTheaterLoadHandler from '../src/org/wanxp/douban/data/handler/DoubanTheaterLoadHandler';
import {SupportType} from '../src/org/wanxp/constant/Constsant';
import {TemplateKey} from '../src/org/wanxp/constant/Constsant';
import {getDefaultTemplateContent} from '../src/org/wanxp/constant/DefaultTemplateContent';

describe('DoubanTheaterLoadHandler', () => {
	const handler = new DoubanTheaterLoadHandler({} as any);

	it('parses semantic theater fields and canonical identity', () => {
		const html = load(`
			<html><head>
				<link rel="canonical" href="https://www.douban.com/location/drama/1234567/">
				<meta property="og:image" content="https://img.example.com/theater.jpg">
			</head><body>
				<div class="drama-info">
					<h1 itemprop="name">被改变的外层标题</h1>
					<img itemprop="image" src="https://img.example.com/poster.jpg">
					<span itemprop="ratingValue">8.7</span>
					<div class="meta"><dl>
						<dt>类型：</dt><dd>话剧 / 喜剧</dd>
						<dt>导演：</dt><dd><a>导演甲</a> / <a>导演乙</a></dd>
						<dt>编剧：</dt><dd><a>编剧甲</a></dd>
						<dt>主演：</dt><dd><a>演员甲</a> / <a>演员乙</a></dd>
						<dt>演出团体：</dt><dd>实验剧团</dd>
						<dt>演出日期：</dt><dd>2025-05-20 至 2025-05-22</dd>
						<dt>语言：</dt><dd>汉语普通话</dd>
						<dt>又名：</dt><dd>别名甲 / 别名乙</dd>
						<dt>原名：</dt><dd>Original Stage Name</dd>
					</dl></div>
					<div class="intro"><p>第一段简介。</p><p>第二段简介。</p></div>
				</div>
			</body></html>`);

		const result = handler.parseSubjectFromHtml(html, {listItem: undefined} as any);

		expect(result).toMatchObject({
			id: '1234567',
			title: '被改变的外层标题',
			type: SupportType.theater,
			score: 8.7,
			publisher: '实验剧团',
			genre: ['话剧', '喜剧'],
			director: ['导演甲', '导演乙'],
			author: ['编剧甲'],
			actor: ['演员甲', '演员乙'],
			language: ['汉语普通话'],
			aliases: ['别名甲', '别名乙'],
			originalTitle: 'Original Stage Name',
		});
		expect(result.desc).toContain('第一段简介。\n\n第二段简介。');
		expect(result.image).toBe('https://img.example.com/poster.jpg');
	});

	it('falls back to data attributes, og metadata and list URL identity', () => {
		const html = load(`
			<html><head>
				<meta property="og:title" content="Old Theater Page">
				<meta property="og:image" content="https://img.example.com/old.jpg">
				<meta property="og:description" content="Fallback description">
			</head><body>
				<div data-object_id="7654321"></div>
			</body></html>`);

		const result = handler.parseSubjectFromHtml(html, {
			listItem: {url: 'https://www.douban.com/location/drama/7654321/'},
		} as any);

		expect(result.id).toBe('7654321');
		expect(result.title).toBe('Old Theater Page');
		expect(result.url).toBe('https://www.douban.com/location/drama/7654321/');
		expect(result.desc).toBe('Fallback description');
	});

	it('provides a complete built-in theater template', () => {
		const template = getDefaultTemplateContent(TemplateKey.theaterTemplateFile, false);
		expect(template).toContain('doubanId: {{id}}');
		expect(template).toContain('director: "[[{{director}}]]"');
		expect(template).toContain('publisher: {{publisher}}');
		expect(template).toContain('{{desc}}');
	});
});
