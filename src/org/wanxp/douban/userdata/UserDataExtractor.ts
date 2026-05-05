/**
 * 用户数据提取器
 *
 * 从本地文件提取用户自定义数据，用于：
 * 1. 导出用户数据
 * 2. 强制同步时保护用户数据
 */

import { App, TFile } from 'obsidian';
import { DoubanUserData, DOUBAN_FIELDS } from './types';
import { scanVaultForDoubanIds, extractDoubanId } from '../../utils/VaultUtil';

export { extractDoubanId };

export class UserDataExtractor {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	extractFromFile(file: TFile): DoubanUserData | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
		return this.extractFromFrontmatter(file, frontmatter ?? null);
	}

	async extractFromFileAsync(file: TFile): Promise<DoubanUserData | null> {
		const result = this.extractFromFile(file);
		if (!result) return null;

		const content = await this.app.vault.read(file);
		const record = extractSection(content, '记录');
		const thoughts = extractSection(content, '感想');
		if (record || thoughts) {
			result.bodySections = { record, thoughts };
		}

		return result;
	}

	async extractFromFolder(
		folderPath: string,
		onProgress?: (current: number, total: number) => void,
	): Promise<Map<string, DoubanUserData>> {
		const entries = scanVaultForDoubanIds(this.app, folderPath);
		const result = new Map<string, DoubanUserData>();
		let processed = 0;
		const total = entries.size;

		for (const [doubanId, { file, frontmatter }] of entries) {
			try {
				const userData = this.extractFromFrontmatter(file, frontmatter);
				if (userData) {
					const content = await this.app.vault.read(file);
					const record = extractSection(content, '记录');
					const thoughts = extractSection(content, '感想');
					if (record || thoughts) {
						userData.bodySections = { record, thoughts };
					}
					result.set(doubanId, userData);
				}
			} catch (e) {
				console.error(`[Douban Sync] 提取用户数据失败: ${file.path}`, e);
			}
			processed++;
			onProgress?.(processed, total);
		}

		return result;
	}

	private extractFromFrontmatter(
		file: TFile,
		frontmatter: Record<string, unknown> | null,
	): DoubanUserData | null {
		if (!frontmatter) return null;

		const doubanId = extractDoubanId(frontmatter);
		if (!doubanId) return null;

		const title = String(frontmatter['title'] ?? file.basename);
		const type = String(frontmatter['type'] ?? 'unknown');
		const customProperties = this.extractCustomProperties(frontmatter);

		return {
			identifier: { doubanId, title, type },
			customProperties: Object.keys(customProperties).length > 0 ? customProperties : undefined,
		};
	}

	private extractCustomProperties(frontmatter: Record<string, unknown>): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(frontmatter)) {
			if (DOUBAN_FIELDS.has(key)) continue;
			if (value === undefined || value === '' || value === null) continue;
			result[key] = value;
		}
		return result;
	}
}

/**
 * 从 markdown 内容中提取指定 ## 分区的内容
 */
export function extractSection(content: string, sectionName: string): string | undefined {
	const normalizedContent = content.replace(/\r\n/g, '\n');
	const lines = normalizedContent.split('\n');
	const heading = `## ${sectionName}`;
	const startIndex = lines.findIndex(line => line.trim() === heading);
	if (startIndex === -1) return undefined;

	let endIndex = lines.length;
	for (let i = startIndex + 1; i < lines.length; i++) {
		if (/^##\s+/.test(lines[i])) {
			endIndex = i;
			break;
		}
	}

	const sectionContent = lines.slice(startIndex + 1, endIndex).join('\n').trim();
	return sectionContent || undefined;
}
