import {App, ButtonComponent, Modal} from "obsidian";
import {i18nHelper} from "../../lang/helper";
import {SyncPreviewResult} from "../sync/model/SyncPreviewResult";

export class SyncPreviewModal extends Modal {
	constructor(
		app: App,
		private result: SyncPreviewResult,
		private onConfirm?: () => Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl('h3', {text: i18nHelper.getMessage('130300')});
		contentEl.createEl('p', {text: i18nHelper.getMessage('130301', String(this.result.affectedCount), String(this.result.total))});

		const summary = contentEl.createEl('ul');
		summary.createEl('li', {text: i18nHelper.getMessage('130302', String(this.result.createCount))});
		summary.createEl('li', {text: i18nHelper.getMessage('130303', String(this.result.replaceCount))});
		summary.createEl('li', {text: i18nHelper.getMessage('130304', String(this.result.existsCount))});
		summary.createEl('li', {text: i18nHelper.getMessage('130305', String(this.result.unHandleCount))});

		if (this.result.backupEnabled && this.result.replaceCount > 0) {
			contentEl.createEl('p', {text: i18nHelper.getMessage('130306')});
		}
		if (this.result.inheritSummary.length > 0) {
			contentEl.createEl('p', {text: i18nHelper.getMessage('130307', this.result.inheritSummary.join(', '))});
		}

		contentEl.createEl('h4', {text: i18nHelper.getMessage('130308')});
		const listEl = contentEl.createEl('ul');
		const previewEntries = this.result.entries.slice(0, 80);
		for (const entry of previewEntries) {
			const suffix = entry.existingFilePath ? ` -> ${entry.existingFilePath}` : '';
			listEl.createEl('li', {text: `${i18nHelper.getMessage(entry.action)} ${entry.title} (${entry.id})${suffix}`});
		}
		if (this.result.entries.length > previewEntries.length) {
			contentEl.createEl('p', {text: i18nHelper.getMessage('130309', String(previewEntries.length), String(this.result.entries.length))});
		}

		const buttonRow = contentEl.createDiv();
		buttonRow.style.display = 'flex';
		buttonRow.style.justifyContent = 'flex-end';
		buttonRow.style.gap = '8px';
		buttonRow.style.marginTop = '12px';

		if (this.onConfirm) {
			new ButtonComponent(buttonRow)
				.setButtonText(i18nHelper.getMessage('130310'))
				.setCta()
				.onClick(async () => {
					await this.onConfirm?.();
					this.close();
				});
		}

		new ButtonComponent(buttonRow)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close());
	}
}
