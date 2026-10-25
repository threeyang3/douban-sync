export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
export const MAX_HTTP_RETRIES = 2;
export const MAX_HTTP_REDIRECTS = 5;

export enum HttpRequestErrorKind {
	timeout = 'timeout',
	network = 'network',
	httpStatus = 'http-status',
	redirect = 'redirect',
}

export class HttpRequestError extends Error {
	public readonly kind: HttpRequestErrorKind;
	public readonly status?: number;
	public readonly attempts?: number;

	constructor(
		kind: HttpRequestErrorKind,
		message: string,
		options: {status?: number, attempts?: number, cause?: unknown} = {},
	) {
		super(message);
		this.name = 'HttpRequestError';
		this.kind = kind;
		this.status = options.status;
		this.attempts = options.attempts;
	}
}

export function normalizeHttpMethod(method?: string): string {
	return String(method || 'GET').toUpperCase();
}

export function isIdempotentHttpMethod(method?: string): boolean {
	const normalized = normalizeHttpMethod(method);
	return normalized === 'GET' || normalized === 'HEAD';
}

export function isRetryableHttpStatus(status: number): boolean {
	return status === 429 || (status >= 500 && status <= 599);
}

export function isRetryableHttpError(error: unknown): boolean {
	if (error instanceof HttpRequestError) {
		return error.kind === HttpRequestErrorKind.timeout || error.kind === HttpRequestErrorKind.network;
	}
	const code = String((error as {code?: string})?.code || '');
	return [
		'ECONNRESET',
		'ECONNREFUSED',
		'ENETUNREACH',
		'ENOTFOUND',
		'EAI_AGAIN',
		'ETIMEDOUT',
	].includes(code);
}

export function getHttpRetryDelay(attempt: number): number {
	return Math.min(2_000, 300 * Math.max(1, attempt));
}

export function withHttpTimeout<T>(
	promise: Promise<T>,
	timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
	operation = 'HTTP request',
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new HttpRequestError(
				HttpRequestErrorKind.timeout,
				`${operation} timed out after ${timeoutMs}ms`,
			));
		}, Math.max(1, timeoutMs));
		promise.then(
			value => {
				clearTimeout(timer);
				resolve(value);
			},
			error => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

export function describeHttpError(error: unknown): string {
	if (error instanceof HttpRequestError) {
		const attempts = error.attempts ? ` after ${error.attempts} attempt(s)` : '';
		return `${error.message}${attempts}`;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

export function sanitizeHttpUrlForLog(url: string): string {
	return String(url || '').replace(
		/([?&](?:code|token|ticket|auth|password|session)=)[^&\s]*/gi,
		'$1<redacted>',
	);
}

function isDoubanHost(hostname: string): boolean {
	const normalized = hostname.toLowerCase();
	return normalized === 'douban.com' || normalized.endsWith('.douban.com');
}

export function sanitizeRedirectHeaders(
	headers: Record<string, any>,
	fromUrl: string,
	toUrl: string,
): Record<string, string> {
	const result: Record<string, string> = {};
	Object.entries(headers || {}).forEach(([key, value]) => {
		if (value != null && value !== '') {
			result[key] = String(value);
		}
	});

	let fromHost = '';
	let toHost = '';
	try {
		fromHost = new URL(fromUrl).hostname;
		toHost = new URL(toUrl).hostname;
	} catch (_) {
		// If a redirect URL cannot be parsed, do not forward credentials.
	}

	const sameTrustedDoubanOrigin = isDoubanHost(fromHost) && isDoubanHost(toHost);
	if (sameTrustedDoubanOrigin) {
		return result;
	}

	Object.keys(result).forEach(key => {
		const lowerKey = key.toLowerCase();
		if (
			lowerKey === 'cookie'
			|| lowerKey === 'authorization'
			|| lowerKey === 'proxy-authorization'
		) {
			delete result[key];
		}
	});
	return result;
}
