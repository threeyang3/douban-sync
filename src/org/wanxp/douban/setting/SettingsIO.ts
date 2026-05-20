import { DEFAULT_SETTINGS } from '../../constant/DefaultSettings';
import { DoubanPluginSetting, TemplateConfig, TemplateSource } from './model/DoubanPluginSetting';
import { DEFAULT_DATA_PROTECTION_SETTINGS } from '../userdata/types';

export interface SettingsExportData {
	version: string;
	exportedAt: string;
	includeSensitive: boolean;
	settings: DoubanPluginSetting;
}

const SETTINGS_EXPORT_VERSION = '1.0';
const SENSITIVE_SETTING_KEYS: Array<keyof DoubanPluginSetting> = [
	'loginCookiesContent',
	'loginHeadersContent',
];

function cloneDefaultSettings(): DoubanPluginSetting {
	return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as DoubanPluginSetting;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTemplateConfig(
	value: unknown,
	legacyFilePath: unknown,
): TemplateConfig {
	if (isRecord(value) && typeof value.source === 'string') {
		const source = value.source as TemplateSource;
		if (source === 'builtin') {
			return { source: 'builtin' };
		}
		if (source === 'file') {
			return {
				source: 'file',
				filePath: typeof value.filePath === 'string' ? value.filePath.trim() : '',
			};
		}
		if (source === 'custom') {
			return {
				source: 'custom',
				customContent: typeof value.customContent === 'string' ? value.customContent : '',
			};
		}
	}

	if (typeof value === 'string' && value.trim()) {
		return { source: 'file', filePath: value.trim() };
	}

	if (typeof legacyFilePath === 'string' && legacyFilePath.trim()) {
		return { source: 'file', filePath: legacyFilePath.trim() };
	}

	return { source: 'builtin' };
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeString(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

function normalizeArray<T>(value: unknown, fallback: T[]): T[] {
	return Array.isArray(value) ? (value as T[]) : fallback;
}

function extractSettingsPayload(config: unknown): Record<string, unknown> {
	if (config == null) {
		return {};
	}

	if (!isRecord(config)) {
		throw new Error('invalid_settings_payload');
	}

	if (isRecord(config.settings)) {
		return config.settings;
	}

	return config;
}

export function sanitizeImportedSettings(config: unknown): DoubanPluginSetting {
	const payload = extractSettingsPayload(config);
	const sanitized = cloneDefaultSettings();
	const mutableSanitized = sanitized as unknown as Record<string, unknown>;

	(Object.keys(DEFAULT_SETTINGS) as Array<keyof DoubanPluginSetting>).forEach((key) => {
		if (!(key in payload)) {
			return;
		}

		const value = payload[key];
		switch (key) {
			case 'movieTemplateConfig':
				sanitized.movieTemplateConfig = normalizeTemplateConfig(value, payload.movieTemplateFile);
				return;
			case 'bookTemplateConfig':
				sanitized.bookTemplateConfig = normalizeTemplateConfig(value, payload.bookTemplateFile);
				return;
			case 'musicTemplateConfig':
				sanitized.musicTemplateConfig = normalizeTemplateConfig(value, payload.musicTemplateFile);
				return;
			case 'noteTemplateConfig':
				sanitized.noteTemplateConfig = normalizeTemplateConfig(value, payload.noteTemplateFile);
				return;
			case 'gameTemplateConfig':
				sanitized.gameTemplateConfig = normalizeTemplateConfig(value, payload.gameTemplateFile);
				return;
			case 'teleplayTemplateConfig':
				sanitized.teleplayTemplateConfig = normalizeTemplateConfig(value, payload.teleplayTemplateFile);
				return;
			case 'dataProtection':
				if (isRecord(value)) {
					sanitized.dataProtection = {
						preserveCustomProperties: normalizeBoolean(
							value.preserveCustomProperties,
							DEFAULT_DATA_PROTECTION_SETTINGS.preserveCustomProperties,
						),
						preserveRecord: normalizeBoolean(
							value.preserveRecord,
							DEFAULT_DATA_PROTECTION_SETTINGS.preserveRecord,
						),
						preserveThoughts: normalizeBoolean(
							value.preserveThoughts,
							DEFAULT_DATA_PROTECTION_SETTINGS.preserveThoughts,
						),
					};
				}
				return;
			case 'statusBar':
			case 'debugMode':
			case 'cacheImage':
			case 'cacheHighQuantityImage':
			case 'overwriteCoverImage':
			case 'pictureBedFlag':
			case 'syncBackupBeforeReplace':
			case 'includeSensitiveInSettingExport':
				sanitized[key] = normalizeBoolean(value, sanitized[key] as boolean) as never;
				return;
			case 'customProperties':
			case 'syncHandledDataArray':
			case 'arraySettings':
				sanitized[key] = normalizeArray(value, sanitized[key] as never[]) as never;
				return;
			case 'scoreSetting':
			case 'pictureBedSetting':
			case 'templatePresetPaths':
				if (isRecord(value)) {
					sanitized[key] = value as never;
				}
				return;
			case 'searchDefaultType':
			case 'personNameMode':
			case 'onlineSettingsFileName':
			case 'onlineSettingsGistId':
			case 'movieTemplateFile':
			case 'bookTemplateFile':
			case 'musicTemplateFile':
			case 'noteTemplateFile':
			case 'gameTemplateFile':
			case 'teleplayTemplateFile':
			case 'dateFormat':
			case 'timeFormat':
			case 'searchUrl':
			case 'arrayStart':
			case 'arrayElementStart':
			case 'arraySpiltV2':
			case 'arrayElementEnd':
			case 'arrayEnd':
			case 'dataFilePath':
			case 'dataFileNamePath':
			case 'loginCookiesContent':
			case 'loginHeadersContent':
			case 'attachmentPath':
			case 'attachmentFileName':
			case 'pictureBedType':
			case 'notePathTemplate':
			case 'noteTemplateContent':
			case 'noteDefaultFolder':
			case 'syncBackupFolder':
				mutableSanitized[key] = normalizeString(value, sanitized[key] as string);
				return;
			default:
				mutableSanitized[key] = value;
		}
	});

	sanitized.movieTemplateConfig = normalizeTemplateConfig(
		sanitized.movieTemplateConfig,
		sanitized.movieTemplateFile,
	);
	sanitized.bookTemplateConfig = normalizeTemplateConfig(
		sanitized.bookTemplateConfig,
		sanitized.bookTemplateFile,
	);
	sanitized.musicTemplateConfig = normalizeTemplateConfig(
		sanitized.musicTemplateConfig,
		sanitized.musicTemplateFile,
	);
	sanitized.noteTemplateConfig = normalizeTemplateConfig(
		sanitized.noteTemplateConfig,
		sanitized.noteTemplateFile,
	);
	sanitized.gameTemplateConfig = normalizeTemplateConfig(
		sanitized.gameTemplateConfig,
		sanitized.gameTemplateFile,
	);
	sanitized.teleplayTemplateConfig = normalizeTemplateConfig(
		sanitized.teleplayTemplateConfig,
		sanitized.teleplayTemplateFile,
	);

	return sanitized;
}

export function buildSettingsExportData(
	settings: DoubanPluginSetting,
	includeSensitive = false,
): SettingsExportData {
	const exportedSettings = sanitizeImportedSettings(settings);
	const mutableExportedSettings = exportedSettings as unknown as Record<string, unknown>;
	if (!includeSensitive) {
		for (const key of SENSITIVE_SETTING_KEYS) {
			mutableExportedSettings[key] = DEFAULT_SETTINGS[key];
		}
	}

	return {
		version: SETTINGS_EXPORT_VERSION,
		exportedAt: new Date().toISOString(),
		includeSensitive,
		settings: exportedSettings,
	};
}
