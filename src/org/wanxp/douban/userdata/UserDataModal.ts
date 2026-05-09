/**
 * 用户数据导入/导出 UI 模态框
 */

import { App, Modal, ButtonComponent } from 'obsidian';
import DoubanPlugin from '../../main';
import { i18nHelper } from '../../lang/helper';
import { UserDataExporter } from './UserDataExporter';
import { ImportPreviewModal } from './ImportPreviewModal';
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

		const controls = contentEl.createDiv('controls');
		controls.addClass('obsidian_douban_search_controls');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130216'))
			.setCta()
			.onClick(() => {
				this.close();
				new ImportPreviewModal(this.app).open();
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
