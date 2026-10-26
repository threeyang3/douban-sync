import * as http from 'http';
import {AddressInfo} from 'net';
import DesktopHttpUtil from '../src/org/wanxp/utils/desktop/DesktopHttpUtil';
import {HttpRequestError, HttpRequestErrorKind} from '../src/org/wanxp/utils/HttpRequestPolicy';

describe('DesktopHttpUtil', () => {
	let server: http.Server;
	let baseUrl: string;

	beforeEach(async () => {
		server = http.createServer();
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		const address = server.address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${address.port}`;
	});

	afterEach(async () => {
		await new Promise<void>(resolve => server.close(() => resolve()));
	});

	it('retries transient failures for GET and eventually succeeds', async () => {
		let attempts = 0;
		server.on('request', (_request, response) => {
			attempts++;
			response.statusCode = attempts < 3 ? 503 : 200;
			response.end(attempts < 3 ? 'retry' : 'ok');
		});

		const response = await DesktopHttpUtil.request(
			`${baseUrl}/retry`,
			{},
			undefined,
			{retryCount: 2, timeoutMs: 1_000},
		);

		expect(response.status).toBe(200);
		expect(response.textString).toBe('ok');
		expect(attempts).toBe(3);
	});

	it('does not retry a POST after a server failure', async () => {
		let attempts = 0;
		server.on('request', (_request, response) => {
			attempts++;
			response.statusCode = 503;
			response.end('unavailable');
		});

		await expect(DesktopHttpUtil.request(
			`${baseUrl}/post`,
			{'Content-Type': 'application/json'},
			undefined,
			{method: 'POST', body: '{}', retryCount: 5, timeoutMs: 1_000},
		)).rejects.toMatchObject<Partial<HttpRequestError>>({
			kind: HttpRequestErrorKind.httpStatus,
			status: 503,
			attempts: 1,
		});
		expect(attempts).toBe(1);
	});

	it('preserves POST method, headers, and request body', async () => {
		let receivedMethod = '';
		let receivedBody = '';
		let receivedContentType = '';
		server.on('request', (request, response) => {
			receivedMethod = String(request.method);
			receivedContentType = String(request.headers['content-type'] || '');
			request.on('data', chunk => receivedBody += chunk.toString());
			request.on('end', () => {
				response.statusCode = 200;
				response.end('ok');
			});
		});

		const response = await DesktopHttpUtil.request(
			`${baseUrl}/post-ok`,
			{'Content-Type': 'application/json'},
			undefined,
			{method: 'POST', body: '{"value":1}', timeoutMs: 1_000},
		);

		expect(response.status).toBe(200);
		expect(receivedMethod).toBe('POST');
		expect(receivedBody).toBe('{"value":1}');
		expect(receivedContentType).toBe('application/json');
	});

	it('aborts a request that exceeds the configured timeout', async () => {
		server.on('request', (_request, _response) => {
			// Intentionally leave the response open.
		});

		const startedAt = Date.now();
		await expect(DesktopHttpUtil.request(
			`${baseUrl}/hang`,
			{},
			undefined,
			{retryCount: 0, timeoutMs: 30},
		)).rejects.toMatchObject<Partial<HttpRequestError>>({
			kind: HttpRequestErrorKind.timeout,
		});
		expect(Date.now() - startedAt).toBeLessThan(1_000);
	});

	it('applies an absolute timeout even when the server keeps sending bytes', async () => {
		server.on('request', (_request, response) => {
			response.writeHead(200, {'Content-Type': 'text/plain'});
			const interval = setInterval(() => response.write('.'), 5);
			response.on('close', () => clearInterval(interval));
		});

		const startedAt = Date.now();
		await expect(DesktopHttpUtil.request(
			`${baseUrl}/trickle`,
			{},
			undefined,
			{retryCount: 0, timeoutMs: 30},
		)).rejects.toMatchObject<Partial<HttpRequestError>>({
			kind: HttpRequestErrorKind.timeout,
		});
		expect(Date.now() - startedAt).toBeLessThan(1_000);
	});
});
