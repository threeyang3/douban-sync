export enum DoubanQrLoginStatus {
	pending = 'pending',
	scanned = 'scanned',
	confirmed = 'confirmed',
	invalid = 'invalid',
	cancelled = 'cancelled',
	unknown = 'unknown',
}

export class DoubanCookieJar {
	private readonly cookies = new Map<string, string>();

	clear(): void {
		this.cookies.clear();
	}

	update(headers: Record<string, unknown>): void {
		const newBid = this.getHeaderValues(headers, 'x-douban-newbid')[0];
		if (newBid) {
			this.cookies.set('bid', newBid);
		}
		this.getHeaderValues(headers, 'set-cookie')
			.flatMap(header => header.split(/\n|,(?=\s*[^;,=\s]+=)/))
			.forEach(cookieValue => {
				const match = cookieValue.match(/^\s*([^=;\s]+)=([^;]*)/);
				if (match) {
					this.cookies.set(match[1], match[2]);
				}
			});
	}

	has(name: string): boolean {
		return this.cookies.has(name);
	}

	toCookieHeader(): string {
		return Array.from(this.cookies.entries())
			.map(([name, value]) => `${name}=${value}`)
			.join('; ');
	}

	private getHeaderValues(headers: Record<string, unknown>, name: string): string[] {
		const key = Object.keys(headers || {}).find(header => header.toLowerCase() === name.toLowerCase());
		if (!key) {
			return [];
		}
		const value = headers[key];
		if (Array.isArray(value)) {
			return value.filter(item => item != null).map(item => String(item));
		}
		return value == null ? [] : [String(value)];
	}
}

export function parseDoubanQrLoginStatus(payload: any): DoubanQrLoginStatus {
	switch (payload?.login_status) {
		case 'pending':
			return DoubanQrLoginStatus.pending;
		case 'scan':
			return DoubanQrLoginStatus.scanned;
		case 'login':
			return DoubanQrLoginStatus.confirmed;
		case 'invalid':
			return DoubanQrLoginStatus.invalid;
		case 'cancel':
			return DoubanQrLoginStatus.cancelled;
		default:
			return DoubanQrLoginStatus.unknown;
	}
}

export function getDoubanQrContent(code: string, imageUrl?: string): string {
	if (imageUrl) {
		try {
			const pathname = new URL(imageUrl, 'https://accounts.douban.com/passport/login').pathname;
			const prefix = '/dae/qrgen/v2/';
			if (pathname.startsWith(prefix) && pathname.endsWith('.png')) {
				return decodeURIComponent(pathname.substring(prefix.length, pathname.length - 4));
			}
		} catch (_) {
			// Use the official QR login URL when the image path is not parseable.
		}
	}
	return `https://accounts.douban.com/passport/qrlogin?code=${encodeURIComponent(code)}`;
}
