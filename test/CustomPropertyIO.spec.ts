import {
	buildCustomPropertyExportData,
	importCustomProperties,
	parseCustomPropertyImportJson,
} from '../src/org/wanxp/douban/setting/CustomPropertyIO';
import { SupportType } from '../src/org/wanxp/constant/Constsant';

describe('CustomPropertyIO', () => {
	it('exports only valid custom properties', () => {
		const result = buildCustomPropertyExportData([
			{ name: 'rating', value: '{{score}}', field: SupportType.movie },
			{ name: '', value: 'x', field: SupportType.book },
			{} as never,
		]);

		expect(result.version).toBe('1.0');
		expect(result.customProperties).toEqual([
			{ name: 'rating', value: '{{score}}', field: SupportType.movie },
		]);
	});

	it('merges imported properties by name and type', () => {
		const current = [
			{ name: 'rating', value: '{{score}}', field: SupportType.movie },
			{ name: 'shelf', value: 'read', field: SupportType.book },
		];
		const imported = parseCustomPropertyImportJson(JSON.stringify({
			version: '1.0',
			customProperties: [
				{ name: 'rating', value: '{{myRating}}', field: 'movie' },
				{ name: 'mood', value: 'great', field: 'book' },
			],
		}));

		expect(importCustomProperties(current, imported, 'merge')).toEqual([
			{ name: 'rating', value: '{{myRating}}', field: SupportType.movie },
			{ name: 'shelf', value: 'read', field: SupportType.book },
			{ name: 'mood', value: 'great', field: SupportType.book },
		]);
	});

	it('overwrites with imported properties', () => {
		const imported = parseCustomPropertyImportJson(JSON.stringify({
			version: '1.0',
			customProperties: [{ name: 'rating', value: '5', field: 'movie' }],
		}));

		expect(importCustomProperties([
			{ name: 'old', value: '1', field: SupportType.book },
		], imported, 'overwrite')).toEqual([
			{ name: 'rating', value: '5', field: SupportType.movie },
		]);
	});

	it('rejects invalid json payload', () => {
		expect(() => parseCustomPropertyImportJson('{')).toThrow('invalid_json');
	});

	it('rejects invalid support type', () => {
		expect(() => parseCustomPropertyImportJson(JSON.stringify({
			version: '1.0',
			customProperties: [{ name: 'rating', value: '5', field: 'unknown' }],
		}))).toThrow('invalid_custom_property_field');
	});
});
