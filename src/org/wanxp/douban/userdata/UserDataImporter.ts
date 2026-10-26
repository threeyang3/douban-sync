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
	FieldDiff,
	EntryDiff,
	FieldStrategy,
	ImportAttributeSettings,
	DOUBAN_FIELDS,
} from './types';
import { scanVaultForDoubanIds, DoubanFileEntry } from '../../utils/VaultUtil';

export class UserDataImporter {
	private app: App;
	private merger: UserDataMerger;
	private fileCache: Map<string, DoubanFileEntry> | null = null;

	constructor(app: App) {
		this.app = app;
		this.merger = new UserDataMerger();
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

	/**
	 * 解析导入文件内容为 UserDataExport
	 */
	parseImportContent(fileName: string, content: string): UserDataExport {
		try {
			const data = JSON.parse(content);
			if (!data || typeof data !== 'object' || !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) {
				throw new Error('Invalid import data: missing items');
			}
			for (const item of Object.values(data.items)) {
				if (!item || typeof item !== 'object' || Array.isArray(item)) {
					throw new Error('Invalid import item');
				}
				const entry = item as DoubanUserData;
				if (entry.customProperties != null && (typeof entry.customProperties !== 'object' || Array.isArray(entry.customProperties))) {
					throw new Error('Invalid custom properties');
				}
				if (entry.bodySections != null && (typeof entry.bodySections !== 'object' || Array.isArray(entry.bodySections)
					|| Object.values(entry.bodySections).some(value => typeof value !== 'string'))) {
					throw new Error('Invalid body sections');
				}
			}
			return data as UserDataExport;
		} catch (error: unknown) {
			throw new Error(`Failed to parse import file ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * 仅构建差异列表，不写入
	 */
	async buildDiffs(importData: UserDataExport, attrSettings?: ImportAttributeSettings): Promise<EntryDiff[]> {
		this.fileCache = scanVaultForDoubanIds(this.app);
		const results: EntryDiff[] = [];

		const ignoredSet = new Set(attrSettings?.ignoredFields ?? []);
		const aliasMap = attrSettings?.fieldAliases ?? {};

		for (const [doubanId, userData] of Object.entries(importData.items)) {
			const localEntry = this.fileCache.get(doubanId) ?? null;
			const localFile = localEntry?.file ?? null;

			if (!localFile) {
				results.push({
					doubanId,
					title: userData.identifier?.title ?? doubanId,
					type: userData.identifier?.type ?? '',
					localFile: null,
					fieldDiffs: [],
					identical: false,
					selected: true,
				});
				continue;
			}

			const localFrontmatter = localEntry.frontmatter ?? {};
			const importCustom: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(userData.customProperties ?? {})) {
				if (DOUBAN_FIELDS.has(key) || ignoredSet.has(key)) continue;
				const target = aliasMap[key]?.trim() || key;
				if (DOUBAN_FIELDS.has(target)) continue;
				Object.defineProperty(importCustom, target, {value, enumerable: true, configurable: true});
			}
			const localFm = localFrontmatter as Record<string, unknown>;
			const fieldDiffs: FieldDiff[] = [];
			let identical = true;

			// 收集所有自定义属性名（导入中有 + 本地中非 DOUBAN_FIELDS 的）
			const allFieldNames = new Set<string>();
			for (const key of Object.keys(importCustom)) {
				if (!DOUBAN_FIELDS.has(key) && !ignoredSet.has(key)) allFieldNames.add(key);
			}
			for (const key of Object.keys(localFm)) {
				if (!DOUBAN_FIELDS.has(key) && !ignoredSet.has(key)) allFieldNames.add(key);
			}

			for (const fieldName of allFieldNames) {
				const localValue = localFm[fieldName];
				const importValue = importCustom[fieldName];
				const localEmpty = this.isEmptyValue(localValue);
				const importEmpty = this.isEmptyValue(importValue);

				// 两者都为空或值完全相同 → 无差异
				if (localEmpty && importEmpty) continue;
				if (!localEmpty && !importEmpty && JSON.stringify(localValue) === JSON.stringify(importValue)) continue;
				// 本地有值但导入为空 → 保留本地，不产生差异
				if (!localEmpty && importEmpty) continue;

				identical = false;
				const strategy: FieldStrategy = localEmpty && !importEmpty ? 'overwrite' : 'smart_merge';
				fieldDiffs.push({
					fieldName,
					localValue,
					importValue,
					strategy,
				});
			}

			if (userData.bodySections) {
				const content = await this.app.vault.read(localFile);
				for (const [key, sectionName] of [['record', '记录'], ['thoughts', '感想']] as const) {
					const importValue = userData.bodySections[key]?.trim();
					if (!importValue) continue;
					const localValue = this.merger.getSection(content, sectionName);
					if (localValue === importValue) continue;
					identical = false;
					fieldDiffs.push({fieldName: `## ${sectionName}`, sectionName, localValue, importValue,
						strategy: localValue ? 'smart_merge' : 'overwrite'});
				}
			}

			results.push({
				doubanId,
				title: userData.identifier?.title ?? doubanId,
				type: userData.identifier?.type ?? '',
				localFile,
				fieldDiffs,
				identical,
				selected: true,
			});
		}

		this.fileCache = null;
		return results;
	}

	/**
	 * 按用户选择的策略执行导入
	 */
	async applyDiffs(diffs: EntryDiff[], onProgress?: (current: number, total: number) => void): Promise<ImportResult> {
		const result: ImportResult = {
			success: 0,
			skipped: 0,
			errors: [],
			missingFields: [],
		};

		const selected = diffs.filter(d => d.selected);
		const total = selected.length;
		for (let i = 0; i < selected.length; i++) {
			const entry = selected[i];
			onProgress?.(i + 1, total);

			if (!entry.localFile) {
				result.skipped++;
				continue;
			}

			if (entry.identical) {
				result.skipped++;
				continue;
			}

			try {
				let changed = false;
				await this.app.vault.process(entry.localFile, content => {
					let updatedContent = content;
					for (const diff of entry.fieldDiffs) {
						if (diff.strategy === 'keep_local') continue;
						const localValue = diff.sectionName
							? this.merger.getSection(updatedContent, diff.sectionName)
							: this.merger.getFrontmatterValue(updatedContent, diff.fieldName);
						if (JSON.stringify(localValue) === JSON.stringify(diff.importValue)) continue;
						let value = diff.importValue;
						if (diff.strategy === 'smart_merge' && !this.isEmptyValue(localValue)) {
							value = Array.isArray(localValue) && Array.isArray(diff.importValue)
								? [...new Set([...localValue, ...diff.importValue])]
								: `${localValue}${diff.sectionName ? '\n\n' : ' / '}${diff.importValue ?? ''}`;
						}
						updatedContent = diff.sectionName
							? this.merger.updateSection(updatedContent, diff.sectionName, String(value))
							: this.merger.updateFrontmatterField(updatedContent, diff.fieldName, value);
					}
					changed = updatedContent !== content;
					return updatedContent;
				});

				if (changed) {
					result.success++;
				} else {
					result.skipped++;
				}
			} catch (error) {
				result.errors.push({
					doubanId: entry.doubanId,
					title: entry.title,
					error: String(error),
				});
			}
		}

		return result;
	}

	/**
	 * 扫描 vault 收集所有本地自定义属性名（排除 DOUBAN_FIELDS）
	 */
	collectLocalCustomFields(): string[] {
		const entries = scanVaultForDoubanIds(this.app);
		const fields = new Set<string>();
		for (const entry of entries.values()) {
			const fm = entry.frontmatter as Record<string, unknown>;
			if (!fm) continue;
			for (const key of Object.keys(fm)) {
				if (!DOUBAN_FIELDS.has(key)) fields.add(key);
			}
		}
		return [...fields].sort();
	}

	private isEmptyValue(value: unknown): boolean {
		if (value === null || value === undefined) return true;
		if (typeof value === 'string' && value.trim() === '') return true;
		if (Array.isArray(value) && value.length === 0) return true;
		return false;
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
