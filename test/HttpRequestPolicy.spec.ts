import {
	HttpRequestError,
	HttpRequestErrorKind,
	isIdempotentHttpMethod,
	isRetryableHttpStatus,
	sanitizeRedirectHeaders,
	sanitizeHttpUrlForLog,
	withHttpTimeout,
} from '../src/org/wanxp/utils/HttpRequestPolicy';
import HttpUtil from '../src/org/wanxp/utils/HttpUtil';

describe('HTTP request policy', () => {
	it('only classifies GET and HEAD as idempotent', () => {
		expect(isIdempotentHttpMethod('get')).toBe(true);
		expect(isIdempotentHttpMethod('HEAD')).toBe(true);
		expect(isIdempotentHttpMethod('POST')).toBe(false);
	});

	it('retries throttling and server failures only', () => {
		expect(isRetryableHttpStatus(429)).toBe(true);
		expect(isRetryableHttpStatus(500)).toBe(true);
		expect(isRetryableHttpStatus(503)).toBe(true);
		expect(isRetryableHttpStatus(403)).toBe(false);
		expect(isRetryableHttpStatus(404)).toBe(false);
	});

	it('removes credentials when redirecting outside trusted Douban domains', () => {
		const headers = {
			Cookie: 'secret=value',
			Authorization: 'Bearer token',
			Accept: 'image/*',
		};
		expect(sanitizeRedirectHeaders(
			headers,
			'https://book.douban.com/subject/1/',
			'https://book.douban.com/subject/2/',
		)).toEqual(headers);
		expect(sanitizeRedirectHeaders(
			headers,
			'https://book.douban.com/subject/1/',
			'https://accounts.douban.com/passport/login',
		)).toEqual(headers);
		expect(sanitizeRedirectHeaders(
			headers,
			'https://book.douban.com/subject/1/',
			'https://example.com/image.jpg',
		)).toEqual({Accept: 'image/*'});
	});

	it('never sends Douban credentials to image or upload hosts', () => {
		expect(HttpUtil.buildImageRequestHeaders({
			Cookie: 'secret=value',
			Authorization: 'Bearer token',
			Referer: 'https://movie.douban.com/',
			Accept: 'image/*',
		}, 'https://movie.douban.com/subject/1/')).toEqual({
			Accept: 'image/*',
			Referer: 'https://movie.douban.com/subject/1/',
		});
	});

	it('finishes with a typed timeout error', async () => {
		await expect(withHttpTimeout(
			new Promise(resolve => setTimeout(resolve, 100)),
			10,
			'test request',
		)).rejects.toMatchObject<Partial<HttpRequestError>>({
			kind: HttpRequestErrorKind.timeout,
		});
	});

	it('redacts credentials from URLs included in ordinary diagnostics', () => {
		expect(sanitizeHttpUrlForLog(
			'https://accounts.douban.com/status?code=qr-secret&token=token-secret&page=1',
		)).toBe(
			'https://accounts.douban.com/status?code=<redacted>&token=<redacted>&page=1',
		);
	});
});
