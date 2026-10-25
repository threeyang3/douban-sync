import {requestUrl} from 'obsidian';
import MobileHttpUtil from '../src/org/wanxp/utils/mobile/MobileHttpUtil';
import {HttpRequestError, HttpRequestErrorKind} from '../src/org/wanxp/utils/HttpRequestPolicy';

function response(
	status: number,
	text = '',
	headers: Record<string, string> = {},
): any {
	return {
		status,
		headers,
		text,
		arrayBuffer: new ArrayBuffer(0),
		json: {},
	};
}

describe('MobileHttpUtil', () => {
	const mockedRequestUrl = requestUrl as jest.Mock;

	beforeEach(() => {
		mockedRequestUrl.mockReset();
	});

	it('forwards the complete request headers and retries transient GET failures', async () => {
		mockedRequestUrl
			.mockResolvedValueOnce(response(503, 'busy'))
			.mockResolvedValueOnce(response(200, 'ok'));

		const result = await MobileHttpUtil.request(
			'https://book.douban.com/subject/1/',
			{
				Cookie: 'secret=value',
				'User-Agent': 'obsidian-douban',
				'Accept-Encoding': 'gzip',
			},
			undefined,
			{method: 'GET', retryCount: 1, timeoutMs: 1_000},
		);

		expect(result.status).toBe(200);
		expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
		expect(mockedRequestUrl.mock.calls[0][0].headers).toEqual({
			Cookie: 'secret=value',
			'User-Agent': 'obsidian-douban',
			'Accept-Encoding': 'gzip',
		});
	});

	it('does not retry a failed POST', async () => {
		mockedRequestUrl.mockResolvedValue(response(503, 'busy'));

		await expect(MobileHttpUtil.request(
			'http://127.0.0.1/upload',
			{'Content-Type': 'application/json'},
			undefined,
			{method: 'POST', body: '{}', retryCount: 5, timeoutMs: 1_000},
		)).rejects.toMatchObject<Partial<HttpRequestError>>({
			kind: HttpRequestErrorKind.httpStatus,
			status: 503,
			attempts: 1,
		});
		expect(mockedRequestUrl).toHaveBeenCalledTimes(1);
	});

	it('times out even if the platform request never settles', async () => {
		mockedRequestUrl.mockReturnValue(new Promise(() => {}));

		await expect(MobileHttpUtil.request(
			'https://book.douban.com/subject/hang/',
			{},
			undefined,
			{method: 'GET', retryCount: 0, timeoutMs: 10},
		)).rejects.toMatchObject<Partial<HttpRequestError>>({
			kind: HttpRequestErrorKind.timeout,
		});
	});

	it('strips cookies when a redirect leaves Douban', async () => {
		mockedRequestUrl
			.mockResolvedValueOnce(response(302, '', {
				Location: 'https://example.com/image.jpg',
			}))
			.mockResolvedValueOnce(response(200, 'image'));

		await MobileHttpUtil.request(
			'https://img9.doubanio.com/redirect',
			{Cookie: 'secret=value', Accept: 'image/*'},
			undefined,
			{method: 'GET', retryCount: 0, timeoutMs: 1_000},
		);

		expect(mockedRequestUrl.mock.calls[1][0].headers).toEqual({
			Accept: 'image/*',
		});
	});
});
