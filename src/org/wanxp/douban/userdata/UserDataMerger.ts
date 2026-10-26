/**
 * 用户数据合并器
 *
 * 用于导入和强制同步时合并用户自定义数据
 */

import { DoubanUserData, DataProtectionSettings, DEFAULT_DATA_PROTECTION_SETTINGS } from './types';
import {parseYaml} from 'obsidian';

interface FrontmatterParts {
	prefix: string;
	body: string;
	suffix: string;
	rest: string;
}

function parseFrontmatter(content: string): FrontmatterParts | null {
	const match = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$/);
	if (!match) return null;
	return { prefix: match[1], body: match[2], suffix: match[3], rest: match[4] };
}

export class UserDataMerger {

	mergeUserData(
		newContent: string,
		localUserData: DoubanUserData,
		settings: DataProtectionSettings = DEFAULT_DATA_PROTECTION_SETTINGS,
	): string {
		let result = newContent;

		if (settings.preserveCustomProperties && localUserData.customProperties) {
			result = this.mergeCustomProperties(result, localUserData.customProperties);
		}

		if (localUserData.bodySections) {
			if (settings.preserveRecord && localUserData.bodySections.record) {
				result = this.updateSection(result, '记录', localUserData.bodySections.record);
			}
			if (settings.preserveThoughts && localUserData.bodySections.thoughts) {
				result = this.updateSection(result, '感想', localUserData.bodySections.thoughts);
			}
		}

		return result;
	}

	mergeCustomProperties(content: string, customProperties: Record<string, unknown>): string {
		let result = content;
		for (const [key, value] of Object.entries(customProperties)) {
			if (!this.hasFrontmatterField(result, key)) {
				result = this.addFrontmatterField(result, key, value);
			}
		}
		return result;
	}

	updateFrontmatterField(content: string, field: string, value: unknown): string {
		const parts = parseFrontmatter(content);
		if (!parts) return content;

		const formattedValue = formatFrontmatterValue(value);
		const fieldRegex = buildFrontmatterFieldRegex(field);

		let newBody: string;
		if (fieldRegex.test(parts.body)) {
			newBody = parts.body.replace(fieldRegex, () => `${formatFrontmatterKey(field)}: ${formattedValue}`);
		} else {
			newBody = `${parts.body}\n${formatFrontmatterKey(field)}: ${formattedValue}`;
		}

		return parts.prefix + newBody + parts.suffix + parts.rest;
	}

	addFrontmatterField(content: string, field: string, value: unknown): string {
		const parts = parseFrontmatter(content);
		if (!parts) return content;

		const formattedValue = formatFrontmatterValue(value);
		const newBody = `${parts.body}\n${formatFrontmatterKey(field)}: ${formattedValue}`;

		return parts.prefix + newBody + parts.suffix + parts.rest;
	}

	hasFrontmatterField(content: string, field: string): boolean {
		const parts = parseFrontmatter(content);
		if (!parts) return false;

		return buildFrontmatterFieldRegex(field).test(parts.body);
	}

	getFrontmatterValue(content: string, field: string): unknown {
		const parts = parseFrontmatter(content);
		if (!parts) return undefined;
		const values = parseYaml(parts.body);
		return values && typeof values === 'object' ? values[field] : undefined;
	}

	getSection(content: string, sectionName: string): string {
		const lines = content.replace(/\r\n/g, '\n').split('\n');
		const start = lines.findIndex(line => line.trim() === `## ${sectionName}`);
		if (start < 0) return '';
		let end = lines.findIndex((line, index) => index > start && /^#{1,2}\s+/.test(line));
		if (end < 0) end = lines.length;
		return lines.slice(start + 1, end).join('\n').trim();
	}

	updateSection(content: string, sectionName: string, sectionContent: string): string {
		const normalizedContent = content.replace(/\r\n/g, '\n');
		const lines = normalizedContent.split('\n');
		const heading = `## ${sectionName}`;
		const startIndex = lines.findIndex(line => line.trim() === heading);

		if (startIndex !== -1) {
			let endIndex = lines.length;
			for (let i = startIndex + 1; i < lines.length; i++) {
				if (/^#{1,2}\s+/.test(lines[i])) {
					endIndex = i;
					break;
				}
			}

			const replacement = [heading, '', sectionContent.trim()];
			const nextLines = [
				...lines.slice(0, startIndex),
				...replacement,
				...lines.slice(endIndex),
			];
			return nextLines.join('\n').replace(/\n+$/, '\n');
		}

		return normalizedContent.replace(/\n*$/, '') + `\n\n## ${sectionName}\n\n${sectionContent.trim()}\n`;
	}
}

function formatFrontmatterValue(value: unknown): string {
	if (typeof value === 'string') {
		if (
			value.includes(':') || value.includes('#') || value.includes('\n') ||
			value.includes('"') || value.includes("'") || value.includes('[') || value.includes('{') ||
			value.includes('\\') || !value.trim() || value.trim() !== value ||
			/^(?:true|false|null|~)$/i.test(value) || /^[+-]?(?:\d|\.\d|\.inf|\.nan)/i.test(value) ||
			/^[*&!>|%@`,?\]}-]/.test(value)
		) {
			return JSON.stringify(value);
		}
		return value;
	}

	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'number') return String(value);

	if (Array.isArray(value)) {
		return `\n${value.map(item => `  - ${formatFrontmatterValue(item)}`).join('\n')}`;
	}

	if (typeof value === 'object' && value !== null) {
		return JSON.stringify(value);
	}

	return String(value);
}

function buildFrontmatterFieldRegex(field: string): RegExp {
	const keys = [field, JSON.stringify(field), `'${field.replace(/'/g, "''")}'`];
	return new RegExp(`^(?:${keys.map(escapeRegExp).join('|')}):[\\t ]*[^\\r\\n]*(?:\\r?\\n(?:[\\t ]+[^\\r\\n]*|-[\\t ]+[^\\r\\n]*))*`, 'm');
}

function formatFrontmatterKey(field: string): string {
	return /^[\w\u4e00-\u9fff-]+$/.test(field) ? field : JSON.stringify(field);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
