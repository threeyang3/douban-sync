import { buildSettingsExportData, sanitizeImportedSettings } from '../src/org/wanxp/douban/setting/SettingsIO';

describe('SettingsIO', () => {
	it('excludes sensitive login settings by default on export', () => {
		const settings = sanitizeImportedSettings({
			loginCookiesContent: 'cookie=value',
			loginHeadersContent: '{"Cookie":"cookie=value"}',
		});

		const exported = buildSettingsExportData(settings, false);
		expect(exported.includeSensitive).toBe(false);
		expect(exported.settings.loginCookiesContent).toBe('');
		expect(exported.settings.loginHeadersContent).toBe('');
	});

	it('can include sensitive login settings when explicitly requested', () => {
		const settings = sanitizeImportedSettings({
			loginCookiesContent: 'cookie=value',
			loginHeadersContent: '{"Cookie":"cookie=value"}',
		});

		const exported = buildSettingsExportData(settings, true);
		expect(exported.settings.loginCookiesContent).toBe('cookie=value');
		expect(exported.settings.loginHeadersContent).toBe('{"Cookie":"cookie=value"}');
	});

	it('sanitizes imported settings with whitelist behavior', () => {
		const sanitized = sanitizeImportedSettings({
			settings: {
				debugMode: true,
				unknownKey: 'ignored',
				dataProtection: {
					preserveCustomProperties: false,
				},
				movieTemplateConfig: '/Templates/movie.md',
				theaterTemplateFile: '/Templates/theater.md',
			},
		});

		expect(sanitized.debugMode).toBe(true);
		expect((sanitized as unknown as Record<string, unknown>).unknownKey).toBeUndefined();
		expect(sanitized.dataProtection.preserveCustomProperties).toBe(false);
		expect(sanitized.dataProtection.preserveRecord).toBe(true);
		expect(sanitized.movieTemplateConfig).toEqual({
			source: 'file',
			filePath: '/Templates/movie.md',
		});
		expect(sanitized.theaterTemplateFile).toBe('/Templates/theater.md');
		expect(sanitized.theaterTemplateConfig).toEqual({
			source: 'file',
			filePath: '/Templates/theater.md',
		});
	});

	it('falls back to defaults for missing payload', () => {
		const sanitized = sanitizeImportedSettings(undefined);
		expect(sanitized.syncBackupBeforeReplace).toBe(true);
		expect(sanitized.syncBackupFolder).toBe('.tmp/obsidian-douban/backups');
		expect(sanitized.showAfterCreate).toBe(true);
		expect(sanitized.arrayLengthLimits).toEqual([]);
		expect(sanitized.theaterTemplateConfig).toEqual({source: 'builtin'});
	});

	it('normalizes array length limits and ignores malformed entries', () => {
		const sanitized = sanitizeImportedSettings({
			showAfterCreate: false,
			arrayLengthLimits: [
				{type: 'movie', field: ' actor ', limit: 5},
				{type: 'BOOK', field: 'author', limit: 2.9},
				{type: 'unknown', field: 'actor', limit: 3},
				{type: 'book', field: '', limit: 3},
				{type: 'book', field: 'translator', limit: -1},
			],
		});

		expect(sanitized.showAfterCreate).toBe(false);
		expect(sanitized.arrayLengthLimits).toEqual([
			{type: 'movie', field: 'actor', limit: 5},
			{type: 'book', field: 'author', limit: 2},
		]);
	});
});
