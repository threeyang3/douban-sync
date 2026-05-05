import { CustomProperty } from "./model/CustomProperty";
import { SupportType, SupportTypeMap } from "../../constant/Constsant";

export interface CustomPropertyExportData {
	version: string;
	customProperties: CustomProperty[];
}

export type CustomPropertyImportMode = 'merge' | 'overwrite';

const CUSTOM_PROPERTY_EXPORT_VERSION = '1.0';

export function buildCustomPropertyExportData(customProperties: CustomProperty[]): CustomPropertyExportData {
	return {
		version: CUSTOM_PROPERTY_EXPORT_VERSION,
		customProperties: sanitizeCurrentCustomProperties(customProperties),
	};
}

export function parseCustomPropertyImportJson(text: string): CustomPropertyExportData {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (e) {
		throw new Error('invalid_json');
	}
	if (!data || typeof data !== 'object') {
		throw new Error('invalid_payload');
	}
	const payload = data as Record<string, unknown>;
	if (!Array.isArray(payload.customProperties)) {
		throw new Error('invalid_custom_properties');
	}
	return {
		version: typeof payload.version === 'string' ? payload.version : CUSTOM_PROPERTY_EXPORT_VERSION,
		customProperties: normalizeCustomProperties(payload.customProperties as CustomProperty[]),
	};
}

export function importCustomProperties(
	currentCustomProperties: CustomProperty[],
	importData: CustomPropertyExportData,
	mode: CustomPropertyImportMode,
): CustomProperty[] {
	const imported = normalizeCustomProperties(importData.customProperties);
	if (mode === 'overwrite') {
		return imported;
	}
	const merged = new Map<string, CustomProperty>();
	sanitizeCurrentCustomProperties(currentCustomProperties).forEach((item) => {
		merged.set(buildCustomPropertyKey(item), item);
	});
	imported.forEach((item) => {
		merged.set(buildCustomPropertyKey(item), item);
	});
	return Array.from(merged.values());
}

export function normalizeCustomProperties(customProperties: CustomProperty[]): CustomProperty[] {
	if (!Array.isArray(customProperties)) {
		throw new Error('invalid_custom_properties');
	}
	return customProperties.map(normalizeCustomProperty);
}

function sanitizeCurrentCustomProperties(customProperties: CustomProperty[]): CustomProperty[] {
	if (!Array.isArray(customProperties)) {
		return [];
	}
	return customProperties
		.filter((item) => item && typeof item === 'object')
		.filter((item) => typeof item.name === 'string' && item.name.trim())
		.map((item) => {
			try {
				return normalizeCustomProperty(item);
			} catch (e) {
				return null;
			}
		})
		.filter((item): item is CustomProperty => !!item);
}

function normalizeCustomProperty(customProperty: CustomProperty): CustomProperty {
	if (!customProperty || typeof customProperty !== 'object') {
		throw new Error('invalid_custom_property');
	}
	const name = typeof customProperty.name === 'string' ? customProperty.name.trim() : '';
	const value = typeof customProperty.value === 'string' ? customProperty.value : '';
	const field = normalizeSupportType(customProperty.field);
	if (!name) {
		throw new Error('invalid_custom_property_name');
	}
	return { name, value, field };
}

function normalizeSupportType(field: SupportType | string): SupportType {
	if (!field || typeof field !== 'string') {
		throw new Error('invalid_custom_property_field');
	}
	// @ts-ignore
	const supportType = SupportTypeMap[field] || SupportTypeMap[field.toLowerCase()];
	if (!supportType) {
		throw new Error('invalid_custom_property_field');
	}
	return supportType as SupportType;
}

function buildCustomPropertyKey(customProperty: CustomProperty): string {
	return `${customProperty.name}::${customProperty.field}`;
}
