/**
 * 用户数据导入/导出 UI 模态框
 */

import { App, Modal, Setting, ButtonComponent } from 'obsidian';
import DoubanPlugin from '../../main';
import { i18nHelper } from '../../lang/helper';
import { UserDataExporter } from './UserDataExporter';
import { UserDataImporter } from './UserDataImporter';
import { MergeStrategy, ImportResult, MissingFieldDecision } from './types';
import { log } from '../../utils/Logutil';

export class UserDataExportModal extends Modal {
	private plugin: DoubanPlugin;

	constructor(plugin: DoubanPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: i18nHelper.getMessage('130200') });

		const folderPath = this.plugin.settings.dataFilePath || '';
		const outputDir = folderPath;

		contentEl.createEl('p', { text: i18nHelper.getMessage('130201', folderPath) });

		const controls = contentEl.createDiv('controls');
		controls.addClass('obsidian_douban_search_controls');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130202'))
			.setCta()
			.onClick(async () => {
				await this.doExport(folderPath, outputDir);
			})
			.setClass('obsidian_douban_search_button');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close())
			.setClass('obsidian_douban_cancel_button');
	}

	private async doExport(folderPath: string, outputDir: string) {
		const exporter = new UserDataExporter(this.app);
		const progressEl = this.contentEl.createDiv();
		progressEl.setText(i18nHelper.getMessage('130203'));

		const result = await exporter.exportBySubjectType(folderPath, outputDir, (current, total) => {
			progressEl.setText(i18nHelper.getMessage('130204', current, total));
		});

		progressEl.remove();

		if (result.success) {
			log.notice(i18nHelper.getMessage('130205', result.files.length));
			result.files.forEach(f => log.info(`  ${f}`));
		} else {
			log.error(i18nHelper.getMessage('130206', result.error || ''), null);
		}

		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class UserDataImportModal extends Modal {
	private plugin: DoubanPlugin;

	constructor(plugin: DoubanPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: i18nHelper.getMessage('130210') });
		contentEl.createEl('p', { text: i18nHelper.getMessage('130211') });

		let selectedStrategy: MergeStrategy = 'smart';

		new Setting(contentEl)
			.setName(i18nHelper.getMessage('130212'))
			.addDropdown(dropdown => {
				dropdown
					.addOption('smart', i18nHelper.getMessage('130213'))
					.addOption('prefer_local', i18nHelper.getMessage('130214'))
					.addOption('prefer_import', i18nHelper.getMessage('130215'))
					.setValue('smart')
					.onChange(value => {
						selectedStrategy = value as MergeStrategy;
					});
			});

		const controls = contentEl.createDiv('controls');
		controls.addClass('obsidian_douban_search_controls');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130216'))
			.setCta()
			.onClick(() => {
				this.openFilePicker(selectedStrategy);
			})
			.setClass('obsidian_douban_search_button');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close())
			.setClass('obsidian_douban_cancel_button');
	}

	private openFilePicker(strategy: MergeStrategy) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.multiple = true;
		input.onchange = async () => {
			const files = input.files;
			if (!files || files.length === 0) return;

			this.close();
			await this.doImport(Array.from(files), strategy);
		};
		input.click();
	}

	private async doImport(files: File[], strategy: MergeStrategy) {
		const importer = new UserDataImporter(this.app);
		const fileTexts: Array<{ name: string; content: string }> = [];

		for (const file of files) {
			const text = await file.text();
			fileTexts.push({ name: file.name, content: text });
		}

		const result = await importer.importMany(fileTexts, { mergeStrategy: strategy });

		if (result.missingFields.length > 0) {
			new MissingFieldModal(this.plugin, result.missingFields, async (decisions) => {
				await importer.applyMissingFieldDecisions(decisions);
				this.showResult(result);
			}).open();
		} else {
			this.showResult(result);
		}
	}

	private showResult(result: ImportResult) {
		new ImportResultModal(this.plugin, result).open();
	}

	onClose() {
		this.contentEl.empty();
	}
}

class MissingFieldModal extends Modal {
	private decisions: MissingFieldDecision[];
	private onSubmit: (decisions: MissingFieldDecision[]) => void;

	constructor(
		plugin: DoubanPlugin,
		decisions: MissingFieldDecision[],
		onSubmit: (decisions: MissingFieldDecision[]) => void,
	) {
		super(plugin.app);
		this.decisions = decisions;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: i18nHelper.getMessage('130220') });
		contentEl.createEl('p', { text: i18nHelper.getMessage('130221', this.decisions.length) });

		for (const decision of this.decisions) {
			const setting = new Setting(contentEl);
			setting.setName(`${decision.title} - ${decision.fieldName}`);
			setting.setDesc(String(decision.fieldValue ?? ''));
			setting.addDropdown(dropdown => {
				dropdown
					.addOption('skip', i18nHelper.getMessage('130222'))
					.addOption('add', i18nHelper.getMessage('130223'))
					.setValue('skip')
					.onChange(value => {
						decision.decision = value as 'add' | 'skip';
					});
			});
		}

		const controls = contentEl.createDiv('controls');
		controls.addClass('obsidian_douban_search_controls');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130224'))
			.setCta()
			.onClick(() => {
				this.onSubmit(this.decisions);
				this.close();
			})
			.setClass('obsidian_douban_search_button');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close())
			.setClass('obsidian_douban_cancel_button');
	}

	onClose() {
		this.contentEl.empty();
	}
}

class ImportResultModal extends Modal {
	private result: ImportResult;

	constructor(plugin: DoubanPlugin, result: ImportResult) {
		super(plugin.app);
		this.result = result;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h3', { text: i18nHelper.getMessage('130230') });

		const summary = contentEl.createDiv();
		summary.createEl('p', { text: i18nHelper.getMessage('130231', this.result.success) });
		summary.createEl('p', { text: i18nHelper.getMessage('130232', this.result.skipped) });

		if (this.result.errors.length > 0) {
			summary.createEl('p', { text: i18nHelper.getMessage('130233', this.result.errors.length) });
			const errorList = summary.createEl('ul');
			for (const err of this.result.errors.slice(0, 10)) {
				errorList.createEl('li', { text: `${err.title}: ${err.error}` });
			}
			if (this.result.errors.length > 10) {
				errorList.createEl('li', { text: `... ${this.result.errors.length - 10} more` });
			}
		}

		new ButtonComponent(contentEl)
			.setButtonText(i18nHelper.getMessage('110005'))
			.setCta()
			.onClick(() => this.close())
			.setClass('obsidian_douban_search_button');
	}

	onClose() {
		this.contentEl.empty();
	}
}
