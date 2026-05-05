/**
 * 用户数据导入器
 *
 * 从备份文件导入用户自定义数据
 */

import { App, TFile } from 'obsidian';
import { UserDataMerger } from './UserDataMerger';
import {
	UserDataExport,
	DoubanUserData,
	ImportOptions,
	ImportResult,
	MissingFieldDecision,
} from './types';
import { scanVaultForDoubanIds, DoubanFileEntry } from '../../utils/VaultUtil';

export class UserDataImporter {
	private app: App;
	private merger: UserDataMerger;
	private fileCache: Map<string, DoubanFileEntry> | null = null;

	constructor(app: App) {
		this.app = app;
		this.merger = new UserDataMerger(app);
	}

	async importFromFile(
		filePath: string,
		options: ImportOptions,
		onProgress?: (current: number, total: number) => void,
	): Promise<ImportResult> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new Error('Import file not found');
		}

		const content = await this.app.vault.read(file);
		return this.importFromText(filePath, content, options, onProgress);
	}

	async importFromText(
		fileName: string,
		content: string,
		options: ImportOptions,
		onProgress?: (current: number, total: number) => void,
	): Promise<ImportResult> {
		try {
			const importData = JSON.parse(content) as UserDataExport;
			return await this.importParsedData(importData, options, onProgress);
		} catch (error: unknown) {
			throw new Error(`Failed to parse import file ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * 从多个文件导入（支持文件路径或已读取的文本内容）
	 */
	async importMany(
		items: Array<{ name: string; content: string }>,
		options: ImportOptions,
		onProgress?: (current: number, total: number) => void,
	): Promise<ImportResult> {
		const combinedResult: ImportResult = {
			success: 0,
			skipped: 0,
			errors: [],
			missingFields: [],
		};

		let processed = 0;
		const total = items.length;

		for (const item of items) {
			try {
				const result = await this.importFromText(item.name, item.content, options);
				combinedResult.success += result.success;
				combinedResult.skipped += result.skipped;
				combinedResult.errors.push(...result.errors);
				combinedResult.missingFields.push(...result.missingFields);
			} catch (error) {
				combinedResult.errors.push({
					doubanId: '0',
					title: item.name,
					error: String(error),
				});
			}

			processed++;
			onProgress?.(processed, total);
		}

		return combinedResult;
	}

	async importFromFiles(
		filePaths: string[],
		options: ImportOptions,
		onProgress?: (current: number, total: number) => void,
	): Promise<ImportResult> {
		const items: Array<{ name: string; content: string }> = [];
		for (const filePath of filePaths) {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				items.push({ name: filePath, content: await this.app.vault.read(file) });
			}
		}
		return this.importMany(items, options, onProgress);
	}

	async applyMissingFieldDecisions(decisions: MissingFieldDecision[]): Promise<void> {
		const grouped = new Map<string, MissingFieldDecision[]>();

		for (const decision of decisions) {
			if (decision.decision === null) continue;
			const existing = grouped.get(decision.doubanId) || [];
			existing.push(decision);
			grouped.set(decision.doubanId, existing);
		}

		for (const [doubanId, fieldDecisions] of grouped) {
			const localFile = this.findLocalFile(doubanId);
			if (!localFile) continue;

			let content = await this.app.vault.read(localFile);

			for (const decision of fieldDecisions) {
				if (decision.decision === 'add') {
					content = this.merger.addFrontmatterField(content, decision.fieldName, decision.fieldValue);
				}
			}

			await this.app.vault.process(localFile, () => content);
		}
	}

	private async importParsedData(
		importData: UserDataExport,
		options: ImportOptions,
		onProgress?: (current: number, total: number) => void,
	): Promise<ImportResult> {
		const result: ImportResult = {
			success: 0,
			skipped: 0,
			errors: [],
			missingFields: [],
		};

		if (!importData.items || typeof importData.items !== 'object') {
			throw new Error('Invalid import data: missing items');
		}

		// 构建一次缓存，避免每个条目都遍历整个 vault
		this.fileCache = scanVaultForDoubanIds(this.app);

		const items = Object.entries(importData.items);
		const total = items.length;

		for (let i = 0; i < items.length; i++) {
			const [doubanId, userData] = items[i];
			onProgress?.(i + 1, total);

			try {
				const importResult = await this.importSingleItem(doubanId, userData, options);

				if (importResult.imported) {
					result.success++;
				} else {
					result.skipped++;
				}

				if (importResult.missingFields) {
					result.missingFields.push(...importResult.missingFields);
				}
			} catch (error) {
				result.errors.push({
					doubanId,
					title: userData.identifier?.title || doubanId,
					error: String(error),
				});
			}
		}

		this.fileCache = null;
		return result;
	}

	private async importSingleItem(
		doubanId: string,
		userData: DoubanUserData,
		options: ImportOptions,
	): Promise<{ imported: boolean; missingFields?: MissingFieldDecision[] }> {
		const localFile = this.findLocalFile(doubanId);
		if (!localFile) {
			return { imported: false };
		}

		const content = await this.app.vault.read(localFile);
		const missingFields: MissingFieldDecision[] = [];
		let updatedContent = content;

		if (userData.customProperties) {
			for (const [key, value] of Object.entries(userData.customProperties)) {
				if (this.merger.hasFrontmatterField(updatedContent, key)) {
					if (options.mergeStrategy === 'prefer_import') {
						updatedContent = this.merger.updateFrontmatterField(updatedContent, key, value);
					} else if (options.mergeStrategy === 'smart') {
						const localValue = this.merger.getFrontmatterValue(updatedContent, key);
						if (!localValue && value !== undefined && value !== null && value !== '') {
							updatedContent = this.merger.updateFrontmatterField(updatedContent, key, value);
						}
					}
				} else {
					missingFields.push({
						doubanId,
						title: userData.identifier.title,
						fieldName: key,
						fieldValue: value,
						decision: null,
					});
				}
			}
		}

		if (userData.bodySections?.record) {
			updatedContent = this.merger.updateSection(updatedContent, '记录', userData.bodySections.record);
		}

		if (userData.bodySections?.thoughts) {
			updatedContent = this.merger.updateSection(updatedContent, '感想', userData.bodySections.thoughts);
		}

		if (updatedContent !== content) {
			await this.app.vault.process(localFile, () => updatedContent);
			return { imported: true, missingFields };
		}

		return { imported: false, missingFields };
	}

	private findLocalFile(doubanId: string): TFile | null {
		if (this.fileCache) {
			const entry = this.fileCache.get(doubanId);
			return entry?.file ?? null;
		}
		// fallback: 单次扫描
		const entries = scanVaultForDoubanIds(this.app);
		const entry = entries.get(doubanId);
		return entry?.file ?? null;
	}
}
