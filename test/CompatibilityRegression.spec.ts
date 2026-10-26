import {sanitizeImportedSettings} from '../src/org/wanxp/douban/setting/SettingsIO';
import {extractDoubanId} from '../src/org/wanxp/utils/VaultUtil';
import {FileUtil} from '../src/org/wanxp/utils/FileUtil';

describe('existing ID and template compatibility', () => {
	it('prefers doubanId over generic frontmatter id aliases', () => {
		expect(extractDoubanId({
			doubanId: '246810',
			id: '135790',
			ID: '112233',
		})).toBe('246810');
	});

	it('keeps custom template content and output path rules unchanged', () => {
		const customContent = [
			'---',
			'doubanId: {{id}}',
			'title: {{title}}',
			'customRule: keep-me',
			'---',
			'',
			'{{desc}}',
		].join('\n');
		const sanitized = sanitizeImportedSettings({
			dataFilePath: 'Archive/Douban',
			dataFileNamePath: '/{{type}}/{{title}}',
			attachmentPath: 'Archive/Assets',
			attachmentFileName: '{{type}}-{{title}}',
			customProperties: [
				{name: 'customRule', value: 'keep-me', field: 'movie'},
			],
			movieTemplateConfig: {
				source: 'custom',
				customContent,
			},
		});

		expect(sanitized.dataFilePath).toBe('Archive/Douban');
		expect(sanitized.dataFileNamePath).toBe('/{{type}}/{{title}}');
		expect(sanitized.attachmentPath).toBe('Archive/Assets');
		expect(sanitized.attachmentFileName).toBe('{{type}}-{{title}}');
		expect(sanitized.customProperties).toEqual([
			{name: 'customRule', value: 'keep-me', field: 'movie'},
		]);
		expect(sanitized.movieTemplateConfig).toEqual({
			source: 'custom',
			customContent,
		});
	});

	it('lets explicit builtin selection override a legacy template file path', () => {
		const sanitized = sanitizeImportedSettings({
			movieTemplateFile: 'Templates/legacy-movie.md',
			movieTemplateConfig: {source: 'builtin'},
			bookTemplateFile: 'Templates/legacy-book.md',
		});

		expect(sanitized.movieTemplateConfig).toEqual({source: 'builtin'});
		expect(sanitized.bookTemplateConfig).toEqual({
			source: 'file',
			filePath: 'Templates/legacy-book.md',
		});
	});

	it('keeps filename rules separate from ID-based note lookup', () => {
		expect(FileUtil.parse('Movies/Under the Skin')).toEqual({
			dir: 'Movies/',
			name: 'Under the Skin',
			extension: 'md',
		});
		expect(extractDoubanId({doubanId: 1234567})).toBe('1234567');
	});
});
