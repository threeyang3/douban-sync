import { extractDoubanId } from '../src/org/wanxp/utils/VaultUtil';

describe('extractDoubanId', () => {
	it('reads the standard doubanId field', () => {
		expect(extractDoubanId({ doubanId: '12345' })).toBe('12345');
	});

	it('supports legacy id aliases', () => {
		expect(extractDoubanId({ id: 67890 })).toBe('67890');
		expect(extractDoubanId({ ID: 'abc' })).toBe('abc');
		expect(extractDoubanId({ douban_id: 'legacy' })).toBe('legacy');
	});

	it('returns null when no compatible id exists', () => {
		expect(extractDoubanId({ title: 'Demo' })).toBeNull();
	});
});
