import {App, Notice, TFile, normalizePath} from 'obsidian';
import DoubanPlugin from '../../main';
import {i18nHelper} from '../../lang/helper';
import {getFileFrontmatter} from '../../utils/FrontmatterUtil';

interface NoteContext {
	doubanId: string;
	title: string;
	type: string;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
	return Object.entries(vars).reduce(
		(s, [k, v]) => s.replaceAll(`{{${k}}}`, v ?? ''),
		template,
	);
}

function stripMd(path: string): string {
	return path.replace(/\.md$/i, '');
}

export class DoubanNoteManager {
	constructor(
		private readonly app: App,
		private readonly plugin: DoubanPlugin,
	) {}

	async createOrAppendForCurrentFile(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!(file instanceof TFile)) {
			new Notice(i18nHelper.getMessage('130130'));
			return;
		}
		await this.createOrAppendForLocalFile(file);
	}

	async createOrAppendForLocalFile(localFile: TFile): Promise<void> {
		const notePathTemplate = this.plugin.settings.notePathTemplate;
		if (!notePathTemplate?.trim()) {
			new Notice(i18nHelper.getMessage('130131'));
			return;
		}

		const context = this.resolveContext(localFile);
		if (!context) {
			new Notice(i18nHelper.getMessage('130130'));
			return;
		}

		const vars = {id: context.doubanId, title: context.title, type: context.type};
		const notePath = normalizePath(applyTemplate(notePathTemplate, vars).replace(/(?<!\.md)$/i, '.md'));
		const existingFile = this.app.vault.getAbstractFileByPath(notePath);

		if (!(existingFile instanceof TFile)) {
			const parentPath = notePath.substring(0, notePath.lastIndexOf('/'));
			if (parentPath && !this.app.vault.getAbstractFileByPath(parentPath)) {
				await this.app.vault.createFolder(parentPath);
			}
			const template = this.plugin.settings.noteTemplateContent;
			const content = template
				? applyTemplate(template, vars)
				: `---\ndoubanId: ${context.doubanId}\ntitle: ${context.title}\n---\n\n# ${context.title}\n\n## 记录\n\n## 感想\n`;
			await this.app.vault.create(notePath, content);
		}

		await this.app.fileManager.processFrontMatter(localFile, (fm) => {
			const noteName = notePath.substring(notePath.lastIndexOf('/') + 1).replace(/\.md$/i, '');
			const link = `[[${stripMd(notePath)}|${noteName}]]`;
			// Obsidian 的 YAML 序列化器不会转义值内部的双引号，
			// 导致含特殊字符的标题（如引号、冒号）破坏 YAML 解析。
			// 手动转义内部双引号，使 Obsidian 添加的外层引号能正确包裹。
			fm['笔记'] = link.includes('"') ? link.replaceAll('"', '\\"') : link;
		});

		await this.app.workspace.openLinkText(stripMd(notePath), localFile.path, true);
		new Notice(i18nHelper.getMessage(existingFile instanceof TFile ? '130133' : '130132', notePath));
	}

	private resolveContext(localFile: TFile): NoteContext | null {
		const frontmatter = getFileFrontmatter(this.app, localFile.path);
		if (!frontmatter) {
			return null;
		}

		const doubanId = toStr(frontmatter['doubanId']);
		if (!doubanId) {
			return null;
		}

		return {
			doubanId,
			title: toStr(frontmatter['title']) || localFile.basename,
			type: toStr(frontmatter['type']) || '',
		};
	}
}

function toStr(value: unknown): string | null {
	if (typeof value === 'string') {
		return value.trim() || null;
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}
	return null;
}
