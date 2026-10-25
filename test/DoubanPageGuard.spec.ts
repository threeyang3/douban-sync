import DoubanPageGuard, {
	DoubanPageGuardError,
	DoubanPageProblem,
} from '../src/org/wanxp/utils/DoubanPageGuard';

describe('DoubanPageGuard', () => {
	it('accepts a normal HTML document and validates a parsed subject', () => {
		expect(DoubanPageGuard.inspect('<html><head><title>电影标题</title></head><body></body></html>').ok)
			.toBe(true);
		expect(() => DoubanPageGuard.assertValidSubject({
			id: '1234567',
			title: 'Under the Skin',
			type: 'movie',
		} as any, 'movie')).not.toThrow();
	});

	it('does not reject a public detail page merely because its navigation contains a login link', () => {
		const html = `
			<html><head>
				<title>Under the Skin (豆瓣)</title>
				<meta property="og:title" content="Under the Skin">
				<script type="application/ld+json">{"@type":"Movie","name":"Under the Skin"}</script>
			</head><body>
				<a href="https://accounts.douban.com/passport/login?redir=x">登录</a>
			</body></html>`;

		expect(DoubanPageGuard.inspect(html).ok).toBe(true);
	});

	it('can accept JSON search responses containing HTML fragments', () => {
		const json = JSON.stringify({
			items: ['<div class="result"><a href="https://movie.douban.com/subject/1234567/">Movie</a></div>'],
		});

		expect(DoubanPageGuard.inspect(json).problem).toBe(DoubanPageProblem.unexpectedHtml);
		expect(() => DoubanPageGuard.assertCanParse(json, {allowFragment: true})).not.toThrow();
	});

	it.each([
		['empty response', '', DoubanPageProblem.empty],
		['login title', '<html><head><title>登录豆瓣</title></head><body></body></html>', DoubanPageProblem.loginRequired],
		['login redirect', '<html><body><a href="https://accounts.douban.com/passport/login?redir=x">登录</a></body></html>', DoubanPageProblem.loginRequired],
		['forbidden title', '<html><head><title>禁止访问</title></head><body></body></html>', DoubanPageProblem.accessDenied],
		['challenge page', '<html><head><title>安全验证</title></head><body></body></html>', DoubanPageProblem.challengeRequired],
		['fragment rather than document', '<div>not a page</div>', DoubanPageProblem.unexpectedHtml],
	])('rejects %s', (_label, html, problem) => {
		const result = DoubanPageGuard.inspect(html);
		expect(result.ok).toBe(false);
		expect(result.problem).toBe(problem);
	});

	it('fails closed when required subject fields are absent or mismatched', () => {
		expect(() => DoubanPageGuard.assertValidSubject({
			id: '',
			title: 'Missing ID',
			type: 'movie',
		} as any, 'movie')).toThrow(DoubanPageGuardError);
		expect(() => DoubanPageGuard.assertValidSubject({
			id: '1234567',
			title: '',
			type: 'movie',
		} as any, 'movie')).toThrow(DoubanPageGuardError);
		expect(() => DoubanPageGuard.assertValidSubject({
			id: '1234567',
			title: 'Wrong type',
			type: 'book',
		} as any, 'movie')).toThrow(DoubanPageGuardError);
	});

	it('reports the failed stage without including response content', () => {
		try {
			DoubanPageGuard.assertCanParse('');
		} catch (error) {
			const message = DoubanPageGuard.describeError(error);
			expect(message).toContain('页面检查失败');
			expect(message).not.toContain('<html>');
		}
	});
});
