import {App, ButtonComponent, Modal, Notice, TextComponent} from "obsidian";
import {i18nHelper} from "../../lang/helper";
import {PathSuggest} from "../setting/model/PathSuggest";

export class TemplateSaveAsModal extends Modal {
	private targetPath = '';

	constructor(
		app: App,
		private onSaveAs: (targetPath: string) => Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl('h3', {text: i18nHelper.getMessage('121943')});
		contentEl.createEl('p', {text: i18nHelper.getMessage('121944')});

		const input = new TextComponent(contentEl);
		input.setPlaceholder('Templates/douban-template.md');
		input.setValue(this.targetPath);
		input.onChange((value) => {
			this.targetPath = value.trim();
		});
		input.inputEl.style.width = '100%';
		new PathSuggest(this.app, input.inputEl, 'file');

		const buttonRow = contentEl.createDiv();
		buttonRow.style.display = 'flex';
		buttonRow.style.justifyContent = 'flex-end';
		buttonRow.style.gap = '8px';
		buttonRow.style.marginTop = '12px';

		new ButtonComponent(buttonRow)
			.setButtonText(i18nHelper.getMessage('110152'))
			.setCta()
			.onClick(async () => {
				if (!this.targetPath) {
					new Notice(i18nHelper.getMessage('121948'));
					return;
				}
				await this.onSaveAs(this.targetPath);
				this.close();
			});

		new ButtonComponent(buttonRow)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close());
	}
}
