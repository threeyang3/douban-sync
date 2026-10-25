import {moment} from 'obsidian';
import {i18nHelper} from '../src/org/wanxp/lang/helper';

describe('dynamic plugin locale', () => {
	it('switches messages when Obsidian locale changes at runtime', () => {
		const localeSpy = jest.spyOn(moment, 'locale').mockReturnValue('en');
		expect(i18nHelper.getMessage('110004')).toBe('Search');

		localeSpy.mockReturnValue('zh-cn');
		expect(i18nHelper.getMessage('110004')).toBe('搜索');
		localeSpy.mockRestore();
	});
});
