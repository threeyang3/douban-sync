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

export async function inheritFrontmatterFields(
	app: App,
	targetFilePath: string,
	sourceFrontmatter: Record<string, unknown> | null,
	fields: string[],
): Promise<void> {
	if (!sourceFrontmatter || !fields || fields.length === 0) {
		return;
	}
	const file = app.vault.getAbstractFileByPath(targetFilePath);
	if (!(file instanceof TFile)) {
		return;
	}
	const finalFields = fields
		.map((field) => field.trim())
		.filter((field) => !!field)
		.filter((field, index, arr) => arr.indexOf(field) === index);
	if (finalFields.length === 0) {
		return;
	}
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		finalFields.forEach((field) => {
			if (Object.prototype.hasOwnProperty.call(sourceFrontmatter, field)) {
				frontmatter[field] = cloneFrontmatterValue(sourceFrontmatter[field]);
			}
		});
	});
}

function cloneFrontmatterValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => cloneFrontmatterValue(item));
	}
	if (value && typeof value === 'object') {
		return JSON.parse(JSON.stringify(value));
	}
	return value;
}
