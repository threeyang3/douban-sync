import type SettingsManager from "../../douban/setting/SettingsManager";
import {HttpResponse} from "../model/HttpResponse";
import {
	DEFAULT_HTTP_TIMEOUT_MS,
	getHttpRetryDelay,
	HttpRequestError,
	HttpRequestErrorKind,
	isIdempotentHttpMethod,
	isRetryableHttpError,
	isRetryableHttpStatus,
	MAX_HTTP_REDIRECTS,
	MAX_HTTP_RETRIES,
	normalizeHttpMethod,
	sanitizeRedirectHeaders,
	sanitizeHttpUrlForLog,
} from "../HttpRequestPolicy";

let httpsClient: any = null;
let httpClient: any = null;

export interface DesktopRequestOptions {
	method?: string;
	body?: string | Buffer;
	headers?: Record<string, any>;
	timeoutMs?: number;
	retryCount?: number;
	[key: string]: any;
}

export default class DesktopHttpUtil {
	public static request(
		url: string,
		headers: Record<string, any>,
		settingsManager?: SettingsManager,
		options: DesktopRequestOptions = {},
	): Promise<HttpResponse> {
		return this.requestWithRetry(url, headers, settingsManager, options, false);
	}

	public static requestBuffer(
		url: string,
		headers: Record<string, any>,
		settingsManager?: SettingsManager,
		options: DesktopRequestOptions = {},
	): Promise<HttpResponse> {
		return this.requestWithRetry(url, headers, settingsManager, options, true);
	}

	private static async requestWithRetry(
		url: string,
		headers: Record<string, any>,
		settingsManager: SettingsManager | undefined,
		options: DesktopRequestOptions,
		asBuffer: boolean,
	): Promise<HttpResponse> {
		const requestHeaders: Record<string, string> = {};
		Object.entries(headers || {}).forEach(([key, value]) => {
			const lowerKey = key.toLowerCase();
			if (
				value != null
				&& value !== ''
				&& lowerKey !== 'accept-encoding'
				&& lowerKey !== 'host'
				&& lowerKey !== 'content-length'
			) {
				requestHeaders[key] = String(value);
			}
		});

		const {
			timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
			retryCount,
			...nativeOptions
		} = options || {};
		const method = normalizeHttpMethod(nativeOptions.method);
		const maxRetries = isIdempotentHttpMethod(method)
			? Math.max(0, retryCount == null ? MAX_HTTP_RETRIES : retryCount)
			: 0;
		const requestOptions: DesktopRequestOptions = {
			...nativeOptions,
			method,
			headers: requestHeaders,
		};

		let lastError: unknown;
		for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
			settingsManager?.debug(
				`Obsidian-Douban:HTTP ${method} ${sanitizeHttpUrlForLog(url)} (attempt ${attempt}/${maxRetries + 1})`,
			);
			try {
				const response = await this.requestOnce(
					url,
					requestOptions,
					Math.max(1, timeoutMs),
					asBuffer,
				);
				if (isRetryableHttpStatus(response.status)) {
					if (attempt <= maxRetries) {
						await this.delay(getHttpRetryDelay(attempt));
						continue;
					}
					throw new HttpRequestError(
						HttpRequestErrorKind.httpStatus,
						`HTTP ${response.status}`,
						{status: response.status, attempts: attempt},
					);
				}
				return response;
			} catch (error) {
				lastError = this.toRequestError(error);
				const canRetry = attempt <= maxRetries
					&& isIdempotentHttpMethod(method)
					&& isRetryableHttpError(lastError);
				if (canRetry) {
					await this.delay(getHttpRetryDelay(attempt));
					continue;
				}
				if (lastError instanceof HttpRequestError) {
					throw lastError;
				}
				throw new HttpRequestError(
					HttpRequestErrorKind.network,
					String(lastError),
					{attempts: attempt, cause: lastError},
				);
			}
		}
		throw this.toRequestError(lastError);
	}

	private static requestOnce(
		url: string,
		options: DesktopRequestOptions,
		timeoutMs: number,
		asBuffer: boolean,
	): Promise<HttpResponse> {
		return new Promise((resolve, reject) => {
			const {body, ...requestOptions} = options;
			const headers = {...(requestOptions.headers || {})};
			if (body && !this.findHeader(headers, 'content-length')) {
				this.setHeader(headers, 'Content-Length', String(Buffer.byteLength(body)));
			}
			let currentUrl = url;
			let currentCookie = this.findHeader(headers, 'cookie');
			requestOptions.headers = headers;
			requestOptions.maxRedirects = MAX_HTTP_REDIRECTS;
			requestOptions.beforeRedirect = (redirectOptions: any, response: any) => {
				const nextHeaders = {...(redirectOptions.headers || {})};
				const nextUrl = this.buildRedirectUrl(redirectOptions);
				const setCookie = this.findHeader(response?.headers || {}, 'set-cookie');
				if (setCookie && this.isDoubanUrl(currentUrl) && this.isDoubanUrl(nextUrl)) {
					currentCookie = this.mergeCookies(currentCookie, this.toArray(setCookie));
					this.setHeader(nextHeaders, 'Cookie', currentCookie);
				}
				redirectOptions.headers = sanitizeRedirectHeaders(nextHeaders, currentUrl, nextUrl);
				currentUrl = nextUrl;
			};

			let settled = false;
			let timer: ReturnType<typeof setTimeout>;
			const finishResolve = (response: HttpResponse) => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					resolve(response);
				}
			};
			const finishReject = (error: unknown) => {
				if (!settled) {
					settled = true;
					clearTimeout(timer);
					reject(this.toRequestError(error));
				}
			};
			let request: any;
			timer = setTimeout(() => {
				const timeoutError = new HttpRequestError(
					HttpRequestErrorKind.timeout,
					`请求在 ${timeoutMs}ms 后超时`,
				);
				finishReject(timeoutError);
				request?.destroy(timeoutError);
			}, timeoutMs);

			try {
				request = this.getHttpClient(url).request(url, requestOptions, (response: any) => {
					const chunks: Buffer[] = [];
					let size = 0;
					response.on('data', (chunk: Buffer) => {
						const buffer = Buffer.from(chunk);
						chunks.push(buffer);
						size += buffer.length;
					});
					response.on('aborted', () => finishReject(
						new HttpRequestError(HttpRequestErrorKind.network, '响应连接被中断'),
					));
					response.on('error', finishReject);
					response.on('end', () => {
						if (settled) {
							return;
						}
						const data = Buffer.concat(chunks, size);
						finishResolve(new HttpResponse(
							response.statusCode,
							response.headers,
							asBuffer ? data : data.toString(),
						));
					});
				});
				request.on('error', finishReject);
				if (body) {
					request.write(body);
				}
				request.end();
			} catch (error) {
				finishReject(error);
			}
		});
	}

	private static toRequestError(error: unknown): HttpRequestError {
		if (error instanceof HttpRequestError) {
			return error;
		}
		const code = String((error as {code?: string})?.code || '');
		if (code === 'ETIMEDOUT' || /timed?\s*out/i.test(String(error))) {
			return new HttpRequestError(
				HttpRequestErrorKind.timeout,
				'请求超时',
				{cause: error},
			);
		}
		const message = error instanceof Error ? error.message : String(error);
		return new HttpRequestError(
			HttpRequestErrorKind.network,
			message || '网络请求失败',
			{cause: error},
		);
	}

	private static buildRedirectUrl(options: any): string {
		if (options?.href) {
			return String(options.href);
		}
		const protocol = options?.protocol || 'https:';
		const hostname = options?.hostname || options?.host || '';
		const port = options?.port ? `:${options.port}` : '';
		const path = options?.path || '/';
		return `${protocol}//${hostname}${port}${path}`;
	}

	private static isDoubanUrl(url: string): boolean {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			return hostname === 'douban.com' || hostname.endsWith('.douban.com');
		} catch (_) {
			return false;
		}
	}

	private static findHeader(headers: Record<string, any>, target: string): string {
		const key = Object.keys(headers || {}).find(item => item.toLowerCase() === target);
		return key ? String(headers[key]) : '';
	}

	private static setHeader(headers: Record<string, any>, name: string, value: string): void {
		Object.keys(headers).forEach(key => {
			if (key.toLowerCase() === name.toLowerCase()) {
				delete headers[key];
			}
		});
		if (value) {
			headers[name] = value;
		}
	}

	private static mergeCookies(existingCookie: string, setCookies: string[]): string {
		const cookies = new Map<string, string>();
		const addCookie = (cookie: string) => {
			const pair = String(cookie || '').split(';', 1)[0].trim();
			const separator = pair.indexOf('=');
			if (separator > 0) {
				cookies.set(pair.substring(0, separator).trim(), pair.substring(separator + 1).trim());
			}
		};
		String(existingCookie || '').split(';').forEach(addCookie);
		setCookies.forEach(addCookie);
		return Array.from(cookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
	}

	private static toArray(value: unknown): string[] {
		return Array.isArray(value) ? value.map(item => String(item)) : [String(value)];
	}

	private static delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private static getHttpClient(url?: string): any {
		if (url && url.startsWith('https')) {
			if (!httpsClient) {
				httpsClient = require('follow-redirects').https;
			}
			return httpsClient;
		}
		if (!httpClient) {
			httpClient = require('follow-redirects').http;
		}
		return httpClient;
	}
}
