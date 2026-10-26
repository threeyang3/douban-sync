import type SettingsManager from "../../douban/setting/SettingsManager";
import {requestUrl, RequestUrlParam, RequestUrlResponse} from "obsidian";
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
	withHttpTimeout,
} from "../HttpRequestPolicy";

interface MobileRequestOptions {
	method?: string;
	body?: string;
	timeoutMs?: number;
	retryCount?: number;
}

export default class MobileHttpUtil {
	public static httpRequestGet(
		url: string,
		headers: Record<string, any>,
		settingsManager?: SettingsManager,
	): Promise<RequestUrlResponse> {
		return this.request(url, headers, settingsManager, {method: 'GET'});
	}

	public static async request(
		url: string,
		headers: Record<string, any>,
		settingsManager?: SettingsManager,
		options: MobileRequestOptions = {},
	): Promise<RequestUrlResponse> {
		const method = normalizeHttpMethod(options.method);
		const timeoutMs = Math.max(1, options.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS);
		const maxRetries = isIdempotentHttpMethod(method)
			? Math.max(0, options.retryCount == null ? MAX_HTTP_RETRIES : options.retryCount)
			: 0;
		const deadline = Date.now() + timeoutMs;

		let lastError: unknown;
		for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
			settingsManager?.debug(
				`Obsidian-Douban:HTTP ${method} ${sanitizeHttpUrlForLog(url)} (attempt ${attempt}/${maxRetries + 1})`,
			);
			try {
				const remaining = Math.max(1, deadline - Date.now());
				const response = await this.requestWithRedirects(
					url,
					headers,
					{...options, method},
					deadline,
					0,
				);
				if (isRetryableHttpStatus(response.status)) {
					if (attempt <= maxRetries) {
						await this.delay(this.getRemainingDelay(attempt, deadline));
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
				if (canRetry && Date.now() < deadline) {
					await this.delay(this.getRemainingDelay(attempt, deadline));
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

	private static async requestWithRedirects(
		url: string,
		headers: Record<string, any>,
		options: MobileRequestOptions,
		deadline: number,
		redirectCount: number,
	): Promise<RequestUrlResponse> {
		const remaining = deadline - Date.now();
		if (remaining <= 0) {
			throw new HttpRequestError(
				HttpRequestErrorKind.timeout,
				`请求在 ${DEFAULT_HTTP_TIMEOUT_MS}ms 后超时`,
			);
		}

		const requestHeaders = this.buildHeaders(headers);
		const requestParam: RequestUrlParam = {
			url,
			method: normalizeHttpMethod(options.method),
			headers: requestHeaders,
			body: options.body,
			throw: false,
		};
		const response = await withHttpTimeout(
			requestUrl(requestParam),
			remaining,
			`请求 ${url}`,
		);
		if (![301, 302, 303, 307, 308].includes(response.status)) {
			return response;
		}
		if (redirectCount >= MAX_HTTP_REDIRECTS) {
			throw new HttpRequestError(
				HttpRequestErrorKind.redirect,
				`重定向次数超过上限 ${MAX_HTTP_REDIRECTS}`,
			);
		}

		const location = this.findHeader(response.headers, 'location');
		if (!location) {
			throw new HttpRequestError(HttpRequestErrorKind.redirect, '重定向响应缺少 Location');
		}
		let nextUrl: string;
		try {
			nextUrl = new URL(location, url).toString();
		} catch (error) {
			throw new HttpRequestError(
				HttpRequestErrorKind.redirect,
				'重定向地址无效',
				{cause: error},
			);
		}

		let nextHeaders: Record<string, any> = {...headers};
		const setCookie = this.findHeader(response.headers, 'set-cookie');
		if (setCookie && this.isDoubanUrl(url) && this.isDoubanUrl(nextUrl)) {
			nextHeaders = this.mergeResponseCookies(nextHeaders, setCookie);
		}
		nextHeaders = sanitizeRedirectHeaders(nextHeaders, url, nextUrl);

		const nextOptions = {...options};
		if ([301, 302, 303].includes(response.status)) {
			nextOptions.method = 'GET';
			delete nextOptions.body;
		}
		return this.requestWithRedirects(
			nextUrl,
			nextHeaders,
			nextOptions,
			deadline,
			redirectCount + 1,
		);
	}

	private static buildHeaders(headers: Record<string, any>): Record<string, string> {
		const result: Record<string, string> = {};
		Object.entries(headers || {}).forEach(([key, value]) => {
			const lowerKey = key.toLowerCase();
			if (
				value != null
				&& value !== ''
				&& lowerKey !== 'host'
				&& lowerKey !== 'content-length'
			) {
				result[key] = String(value);
			}
		});
		return result;
	}

	private static mergeResponseCookies(headers: Record<string, any>, setCookie: string): Record<string, any> {
		const result = {...(headers || {})};
		const cookieKey = Object.keys(result).find(key => key.toLowerCase() === 'cookie');
		const existingCookie = cookieKey ? String(result[cookieKey]) : '';
		const cookies = new Map<string, string>();
		const addCookie = (cookie: string) => {
			const pair = String(cookie || '').split(';', 1)[0].trim();
			const separator = pair.indexOf('=');
			if (separator > 0) {
				cookies.set(pair.substring(0, separator).trim(), pair.substring(separator + 1).trim());
			}
		};
		existingCookie.split(';').forEach(addCookie);
		addCookie(setCookie);
		if (cookieKey) {
			delete result[cookieKey];
		}
		result.Cookie = Array.from(cookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
		return result;
	}

	private static findHeader(headers: Record<string, any>, target: string): string {
		const key = Object.keys(headers || {}).find(item => item.toLowerCase() === target.toLowerCase());
		return key ? String(headers[key]) : '';
	}

	private static isDoubanUrl(url: string): boolean {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			return hostname === 'douban.com' || hostname.endsWith('.douban.com');
		} catch (_) {
			return false;
		}
	}

	private static getRemainingDelay(attempt: number, deadline: number): number {
		return Math.max(1, Math.min(getHttpRetryDelay(attempt), deadline - Date.now()));
	}

	private static toRequestError(error: unknown): HttpRequestError {
		if (error instanceof HttpRequestError) {
			return error;
		}
		const message = error instanceof Error ? error.message : String(error);
		if (/timed?\s*out|timeout/i.test(message)) {
			return new HttpRequestError(
				HttpRequestErrorKind.timeout,
				'请求超时',
				{cause: error},
			);
		}
		return new HttpRequestError(
			HttpRequestErrorKind.network,
			message || '网络请求失败',
			{cause: error},
		);
	}

	private static delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
