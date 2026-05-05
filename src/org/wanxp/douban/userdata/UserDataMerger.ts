/**
 * 用户数据合并器
 *
 * 用于导入和强制同步时合并用户自定义数据
 */

import { App } from 'obsidian';
import { DoubanUserData, DataProtectionSettings, DEFAULT_DATA_PROTECTION_SETTINGS } from './types';
import { extractSection } from './UserDataExtractor';

interface FrontmatterParts {
	prefix: string;
	body: string;
	suffix: string;
	rest: string;
}

function parseFrontmatter(content: string): FrontmatterParts | null {
	const match = content.match(/^(---\n)([\s\S]*?)(\n---)([\s\S]*)$/);
	if (!match) return null;
	return { prefix: match[1], body: match[2], suffix: match[3], rest: match[4] };
}

export class UserDataMerger {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

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
			newBody = parts.body.replace(fieldRegex, `${field}: ${formattedValue}`);
		} else {
			newBody = `${parts.body}\n${field}: ${formattedValue}`;
		}

		return parts.prefix + newBody + parts.suffix + parts.rest;
	}

	addFrontmatterField(content: string, field: string, value: unknown): string {
		const parts = parseFrontmatter(content);
		if (!parts) return content;

		const formattedValue = formatFrontmatterValue(value);
		const newBody = `${parts.body}\n${field}: ${formattedValue}`;

		return parts.prefix + newBody + parts.suffix + parts.rest;
	}

	hasFrontmatterField(content: string, field: string): boolean {
		const parts = parseFrontmatter(content);
		if (!parts) return false;

		const fieldRegex = new RegExp(`^${escapeRegExp(field)}:`, 'm');
		return fieldRegex.test(parts.body);
	}

	getFrontmatterValue(content: string, field: string): string | undefined {
		const parts = parseFrontmatter(content);
		if (!parts) return undefined;

		const lines = parts.body.split('\n');
		const fieldPrefix = `${field}:`;
		const startIndex = lines.findIndex(line => line.startsWith(fieldPrefix));
		if (startIndex === -1) return undefined;

		const inlineValue = lines[startIndex].slice(fieldPrefix.length).trim();
		if (inlineValue) return stripQuotedValue(inlineValue);

		const listItems: string[] = [];
		for (let i = startIndex + 1; i < lines.length; i++) {
			const line = lines[i];
			if (/^[^-\s][^:]*:/.test(line)) break;
			const listMatch = line.match(/^\s*-\s*(.*)$/);
			if (listMatch) {
				listItems.push(stripQuotedValue(listMatch[1].trim()));
				continue;
			}
			if (line.trim() && !/^\s/.test(line)) break;
		}

		return listItems.length > 0 ? listItems.join(', ') : '';
	}

	updateSection(content: string, sectionName: string, sectionContent: string): string {
		const normalizedContent = content.replace(/\r\n/g, '\n');
		const lines = normalizedContent.split('\n');
		const heading = `## ${sectionName}`;
		const startIndex = lines.findIndex(line => line.trim() === heading);

		if (startIndex !== -1) {
			let endIndex = lines.length;
			for (let i = startIndex + 1; i < lines.length; i++) {
				if (/^##\s+/.test(lines[i])) {
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
			value.includes('"') || value.includes("'") || value.includes('[') || value.includes('{')
		) {
			return `"${value.replace(/"/g, '\\"')}"`;
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
	return new RegExp(`^${escapeRegExp(field)}:\\s*.*(?:\\n  - .*?)*$`, 'm');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripQuotedValue(value: string): string {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}
