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
	});

	it('falls back to defaults for missing payload', () => {
		const sanitized = sanitizeImportedSettings(undefined);
		expect(sanitized.syncBackupBeforeReplace).toBe(true);
		expect(sanitized.syncBackupFolder).toBe('.tmp/obsidian-douban/backups');
	});
});
