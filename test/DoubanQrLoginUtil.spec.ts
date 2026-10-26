import {
	DoubanCookieJar,
	DoubanQrLoginStatus,
	getDoubanQrContent,
	parseDoubanQrLoginStatus,
} from '../src/org/wanxp/utils/DoubanQrLoginUtil';
import * as QRCode from 'qrcode';

describe('Douban QR login helpers', () => {
	it('collects QR cookies without losing duplicate Set-Cookie headers', () => {
		const jar = new DoubanCookieJar();
		jar.update({
			'x-douban-newbid': 'bid-value',
			'set-cookie': [
				'dbcl2=user-value; Path=/; HttpOnly',
				'ck=other-value; Path=/',
			],
		});

		expect(jar.has('dbcl2')).toBe(true);
		expect(jar.toCookieHeader()).toBe('bid=bid-value; dbcl2=user-value; ck=other-value');
		jar.clear();
		expect(jar.toCookieHeader()).toBe('');
	});

	it.each([
		['pending', DoubanQrLoginStatus.pending],
		['scan', DoubanQrLoginStatus.scanned],
		['login', DoubanQrLoginStatus.confirmed],
		['invalid', DoubanQrLoginStatus.invalid],
		['cancel', DoubanQrLoginStatus.cancelled],
		['changed', DoubanQrLoginStatus.unknown],
	])('maps %s to a stable login state', (value, expected) => {
		expect(parseDoubanQrLoginStatus({login_status: value})).toBe(expected);
	});

	it('derives local QR content from the official image path', () => {
		expect(getDoubanQrContent(
			'fallback-code',
			'https://accounts.douban.com/dae/qrgen/v2/https%3A%2F%2Fexample.com%2Fqr.png',
		)).toBe('https://example.com/qr');
		expect(getDoubanQrContent('fallback-code')).toBe(
			'https://accounts.douban.com/passport/qrlogin?code=fallback-code',
		);
	});

	it('can render QR content locally without loading a remote image', async () => {
		const result = await QRCode.toDataURL('https://accounts.douban.com/passport/qrlogin?code=test');
		expect(result.startsWith('data:image/png;base64,')).toBe(true);
	});
});
