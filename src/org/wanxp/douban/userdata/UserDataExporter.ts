/**
 * 用户数据导出器
 *
 * 按条目类型导出用户自定义数据到 JSON 文件
 */

import { App, TFile, normalizePath } from 'obsidian';
import { UserDataExtractor } from './UserDataExtractor';
import { UserDataExport, DoubanUserData } from './types';

export class UserDataExporter {
	private app: App;
	private extractor: UserDataExtractor;

	constructor(app: App) {
		this.app = app;
		this.extractor = new UserDataExtractor(app);
	}

	async exportBySubjectType(
		folderPath: string,
		outputDir: string,
		onProgress?: (current: number, total: number) => void,
	): Promise<{ success: boolean; files: string[]; error?: string }> {
		try {
			const userDataMap = await this.extractor.extractFromFolder(folderPath, onProgress);

			if (userDataMap.size === 0) {
				return { success: false, files: [], error: 'No user data found' };
			}

			const groupedData = this.groupBySubjectType(userDataMap);
			await this.ensureDirectory(outputDir);

			const files: string[] = [];

			for (const [typeLabel, items] of Object.entries(groupedData)) {
				if (Object.keys(items).length === 0) continue;

				const exportData: UserDataExport = {
					version: '1.0',
					exportTime: new Date().toISOString(),
					subjectType: typeLabel,
					totalCount: Object.keys(items).length,
					items,
				};

				const fileName = `douban-user-data-${typeLabel}.json`;
				const filePath = normalizePath(`${outputDir}/${fileName}`);

				await this.saveFile(filePath, JSON.stringify(exportData, null, 2));
				files.push(filePath);
			}

			return { success: true, files };
		} catch (error) {
			return { success: false, files: [], error: String(error) };
		}
	}

	private groupBySubjectType(
		userDataMap: Map<string, DoubanUserData>,
	): Record<string, Record<string, DoubanUserData>> {
		const result: Record<string, Record<string, DoubanUserData>> = {};

		for (const [doubanId, userData] of userDataMap) {
			const typeLabel = userData.identifier.type || 'unknown';
			if (!result[typeLabel]) {
				result[typeLabel] = {};
			}
			result[typeLabel][doubanId] = userData;
		}

		return result;
	}

	private async ensureDirectory(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		const exists = await this.app.vault.adapter.exists(normalizedPath);
		if (!exists) {
			await this.app.vault.createFolder(normalizedPath);
		}
	}

	private async saveFile(path: string, content: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (existing instanceof TFile) {
			await this.app.vault.process(existing, () => content);
		} else {
			await this.app.vault.create(normalizedPath, content);
		}
	}
}
