import { App, TFile } from "obsidian";

export function getFileFrontmatter(app: App, filePath: string): Record<string, unknown> | null {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) {
		return null;
	}
	const cache = app.metadataCache.getFileCache(file);
	if (!cache?.frontmatter || typeof cache.frontmatter !== 'object') {
		return null;
	}
	return cache.frontmatter as Record<string, unknown>;
}
