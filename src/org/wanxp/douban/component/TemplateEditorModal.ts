import {App, ButtonComponent, Modal} from "obsidian";
import {i18nHelper} from "../../lang/helper";
import {TemplateKey} from "../../constant/Constsant";

export class TemplateEditorModal extends Modal {
	private content: string;
	private templateKey: TemplateKey;
	private readOnly: boolean;
	private onSave: (content: string) => Promise<void>;

	constructor(
		app: App,
		templateKey: TemplateKey,
		content: string,
		readOnly: boolean = false,
		onSave?: (content: string) => Promise<void>
	) {
		super(app);
		this.templateKey = templateKey;
		this.content = content;
		this.readOnly = readOnly;
		this.onSave = onSave;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl('h3', {
			text: this.readOnly
				? i18nHelper.getMessage('121930')
				: i18nHelper.getMessage('121931')
		});

		// Variable reference (collapsed)
		const details = contentEl.createEl('details');
		details.createEl('summary', {text: i18nHelper.getMessage('121932')});
		const varList = details.createDiv();
		varList.style.fontSize = '12px';
		varList.style.marginTop = '8px';
		varList.style.color = 'var(--text-muted)';
		varList.createEl('p', {text: '{{id}}, {{title}}, {{type}}, {{image}}, {{imageData.url}}, {{score}}, {{url}}, {{desc}}, {{author}}, {{actor}}, {{director}}, {{genre}}, {{datePublished}}, {{currentDate}}, {{currentTime}}'});
		varList.createEl('p', {text: '{{myRating}}, {{myRatingStar}}, {{myTags}}, {{myState}}, {{myComment}}, {{myCollectionDate}}'});

		// Textarea
		const textarea = contentEl.createEl('textarea');
		textarea.value = this.content;
		textarea.style.width = '100%';
		textarea.style.minHeight = '350px';
		textarea.style.fontFamily = 'monospace';
		textarea.style.fontSize = '13px';
		textarea.style.resize = 'vertical';
		if (this.readOnly) {
			textarea.disabled = true;
			textarea.style.opacity = '0.7';
		} else {
			textarea.addEventListener('input', () => {
				this.content = textarea.value;
			});
		}

		// Buttons
		const buttonRow = contentEl.createDiv();
		buttonRow.style.display = 'flex';
		buttonRow.style.justifyContent = 'flex-end';
		buttonRow.style.gap = '8px';
		buttonRow.style.marginTop = '12px';

		if (!this.readOnly) {
			new ButtonComponent(buttonRow)
				.setButtonText(i18nHelper.getMessage('110152'))
				.setCta()
				.onClick(async () => {
					await this.onSave?.(this.content);
					this.close();
				});
		}
		new ButtonComponent(buttonRow)
			.setButtonText(this.readOnly
				? i18nHelper.getMessage('110005')
				: i18nHelper.getMessage('110005'))
			.onClick(() => {
				this.close();
			});
	}
}
