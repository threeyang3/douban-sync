/**
 * Vault 扫描工具
 *
 * 提供按 doubanId 扫描 vault 的共享实现，避免多个模块重复遍历。
 */

import { App, TFile, normalizePath } from 'obsidian';

export interface DoubanFileEntry {
	file: TFile;
	frontmatter: Record<string, unknown>;
}

/**
 * 扫描指定文件夹下所有 markdown 文件，返回 doubanId → 文件条目的映射。
 * 如果 folderPath 为空，则扫描整个 vault。
 */
export function scanVaultForDoubanIds(
	app: App,
	folderPath?: string,
): Map<string, DoubanFileEntry> {
	const result = new Map<string, DoubanFileEntry>();
	const allFiles = app.vault.getMarkdownFiles();

	const normalizedPath = folderPath ? normalizePath(folderPath) : '';
	const targetFiles = normalizedPath
		? allFiles.filter(file => file.path.startsWith(normalizedPath))
		: allFiles;

	for (const file of targetFiles) {
		try {
			const cache = app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
			if (!frontmatter) continue;

			const doubanId = extractDoubanId(frontmatter);
			if (doubanId) {
				result.set(doubanId, { file, frontmatter });
			}
		} catch {
			// 忽略单个文件的缓存错误
		}
	}

	return result;
}

/**
 * 从 frontmatter 中提取 doubanId（字符串形式）
 */
export function extractDoubanId(frontmatter: Record<string, unknown>): string | null {
	const candidateKeys = ['doubanId', 'douban_id', 'id', 'ID'];
	for (const key of candidateKeys) {
		const id = frontmatter[key];
		if (typeof id === 'string' && id.trim()) return id.trim();
		if (typeof id === 'number') return String(id);
	}
	return null;
}
