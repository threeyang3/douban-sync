import {FileUtil} from '../src/org/wanxp/utils/FileUtil';
import {VariableUtil} from '../src/org/wanxp/utils/VariableUtil';
import {DataField} from '../src/org/wanxp/utils/model/DataField';
import {DataValueType} from '../src/org/wanxp/constant/Constsant';

describe('FileUtil path compatibility', () => {
	it.each([
		['Under the Skin', 'Under the Skin'],
		['中文 English  Title', '中文 English  Title'],
		['Title: Part/One?', 'Title_ Part_One_'],
		['...Hidden', '_Hidden'],
		['Trailing...', 'Trailing_'],
		['  padded title  ', 'padded title'],
	])('sanitizes %s without flattening valid spaces', (input, expected) => {
		expect(FileUtil.replaceSpecialCharactersForFileName(input)).toBe(expected);
	});

	it('encodes local Markdown image paths without changing directories or remote URLs', () => {
		expect(FileUtil.toMarkdownLinkPath('assets/covers/Under the Skin.jpg'))
			.toBe('assets/covers/Under%20the%20Skin.jpg');
		expect(FileUtil.toMarkdownLinkPath('封面/电影 封面.jpg'))
			.toBe('%E5%B0%81%E9%9D%A2/%E7%94%B5%E5%BD%B1%20%E5%B0%81%E9%9D%A2.jpg');
		expect(FileUtil.toMarkdownLinkPath('assets/already%20encoded.jpg'))
			.toBe('assets/already%20encoded.jpg');
		expect(FileUtil.toMarkdownLinkPath('assets\\Windows Folder\\cover#1.jpg'))
			.toBe('assets/Windows%20Folder/cover%231.jpg');
		expect(FileUtil.toMarkdownLinkPath('https://img.example.com/a b.jpg'))
			.toBe('https://img.example.com/a b.jpg');
	});

	it('uses the encoded path when rendering a Markdown image template variable', () => {
		const imageField = new DataField(
			'image',
			DataValueType.path,
			'assets/Under the Skin.jpg',
			'assets/Under the Skin.jpg',
		);
		const variables = new Map([['image', imageField]]);

		expect(VariableUtil.replace(
			variables,
			'![cover]({{image}})\n![cover](<{{image}}>)\n封面路径: {{image}}',
			{} as any,
			'text',
		)).toBe(
			'![cover](assets/Under%20the%20Skin.jpg)\n'
			+ '![cover](<assets/Under%20the%20Skin.jpg>)\n'
			+ '封面路径: assets/Under the Skin.jpg',
		);
	});
});
