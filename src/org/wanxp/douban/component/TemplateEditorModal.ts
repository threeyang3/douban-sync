import {App, ButtonComponent, Component, MarkdownRenderer, Modal, Notice} from 'obsidian';
import {i18nHelper} from '../../lang/helper';
import {TemplateKey} from '../../constant/Constsant';
import {TemplateSaveAsModal} from './TemplateSaveAsModal';
import {prepareTemplatePreview, TemplatePreviewDocument} from '../setting/TemplatePreview';

interface TemplateEditorModalOptions {
	readOnly?: boolean;
	onSave?: (content: string) => Promise<void>;
	onSaveAs?: (targetPath: string, content: string) => Promise<void>;
	onRestoreDefault?: () => Promise<string>;
	onPreview?: (content: string) => Promise<TemplatePreviewDocument>;
	sourcePath?: string;
}

export class TemplateEditorModal extends Modal {
	private previewEl: HTMLElement;
	private statusEl: HTMLElement;
	private previewComponent: Component;
	private timer: ReturnType<typeof setTimeout>;
	private revision = 0;
	private opened = false;

	constructor(
		app: App,
		private templateKey: TemplateKey,
		private content: string,
		private options: TemplateEditorModalOptions = {},
	) { super(app); }

	onOpen() {
		this.opened = true;
		this.modalEl.addClass('douban-template-editor');
		const {contentEl} = this;
		contentEl.empty();
		const header = contentEl.createDiv('douban-template-editor-header');
		header.createEl('h2', {text: i18nHelper.getMessage(this.options.readOnly ? 'templateLivePreview' : 'templateEditPreview')});
		header.createEl('p', {text: i18nHelper.getMessage('templatePreviewHint')});
		const workspace = contentEl.createDiv('douban-template-workspace');
		const source = workspace.createDiv('douban-template-source');
		const sourceHeader = source.createDiv('douban-template-pane-heading');
		sourceHeader.createEl('label', {text: i18nHelper.getMessage('templateSourceCode'), attr: {for: `douban-template-${this.templateKey}`}});
		sourceHeader.createSpan({cls: 'douban-template-mode', text: i18nHelper.getMessage(this.options.readOnly ? 'templateReadOnly' : 'templateEditable')});
		const textarea = source.createEl('textarea', {cls: 'douban-template-textarea'});
		textarea.id = `douban-template-${this.templateKey}`;
		textarea.value = this.content;
		textarea.readOnly = !!this.options.readOnly;
		textarea.spellcheck = false;
		textarea.addEventListener('input', () => { this.content = textarea.value; this.schedulePreview(); });
		const preview = workspace.createDiv('douban-template-preview');
		const previewHeader = preview.createDiv('douban-template-pane-heading');
		previewHeader.createSpan({text: i18nHelper.getMessage('templateRenderedResult')});
		this.statusEl = previewHeader.createSpan({cls: 'douban-template-preview-status', attr: {role: 'status', 'aria-live': 'polite'}});
		this.previewEl = preview.createDiv('douban-template-preview-scroll');
		const variables = contentEl.createEl('details', {cls: 'douban-template-variable-reference'});
		variables.createEl('summary', {text: i18nHelper.getMessage('121932')});
		variables.createEl('code', {text: '{{title}} · {{type}} · {{image}} · {{score}} · {{desc}} · {{author}} · {{director}} · {{genre}} · {{myState}} · {{myComment}} · {{currentDate}}'});
		const controls = contentEl.createDiv('douban-template-editor-controls');
		if (!this.options.readOnly) {
			new ButtonComponent(controls).setButtonText(i18nHelper.getMessage('templateSaveChanges')).setCta().onClick(async () => {
				try {
					await this.options.onSave?.(this.content);
					this.close();
				} catch (error) {
					new Notice(error instanceof Error ? error.message : String(error));
				}
			});
			if (this.options.onRestoreDefault) {
				new ButtonComponent(controls).setButtonText(i18nHelper.getMessage('121946')).onClick(async () => {
					this.content = await this.options.onRestoreDefault();
					textarea.value = this.content; this.schedulePreview();
				});
			}
		}
		if (this.options.onSaveAs) {
			new ButtonComponent(controls).setButtonText(i18nHelper.getMessage('121943')).onClick(() => {
				new TemplateSaveAsModal(this.app, path => this.options.onSaveAs(path, this.content)).open();
			});
		}
		new ButtonComponent(controls).setButtonText(i18nHelper.getMessage('110005')).onClick(() => this.close());
		this.schedulePreview(0);
	}

	private schedulePreview(delay = 200): void {
		clearTimeout(this.timer);
		const revision = ++this.revision;
		this.statusEl.setText(i18nHelper.getMessage('templatePreviewUpdating'));
		this.timer = setTimeout(() => void this.renderPreview(revision), delay);
	}

	private async renderPreview(revision: number): Promise<void> {
		const component = new Component();
		component.load();
		try {
			const result = this.options.onPreview ? await this.options.onPreview(this.content) : prepareTemplatePreview(this.content);
			if (!this.opened || revision !== this.revision) { component.unload(); return; }
			const stage = this.previewEl.ownerDocument.createElement('div');
			stage.className = 'douban-template-preview-document';
			if (result.yamlError) {
				stage.createDiv({cls: 'douban-template-preview-warning', text: `${i18nHelper.getMessage('templatePreviewYamlError')} ${result.yamlError}`});
			}
			if (result.unresolved.length) {
				stage.createDiv({cls: 'douban-template-preview-warning', text: `${i18nHelper.getMessage('templatePreviewUnknown')} ${result.unresolved.join(', ')}`});
			}
			if (Object.keys(result.properties).length) {
				const props = stage.createEl('details', {cls: 'douban-template-preview-properties'});
				props.createEl('summary', {text: `${i18nHelper.getMessage('templatePreviewProperties')} · ${Object.keys(result.properties).length}`});
				const list = props.createEl('dl');
				Object.entries(result.properties).forEach(([key, value]) => {
					list.createEl('dt', {text: key});
					list.createEl('dd', {text: Array.isArray(value) ? value.join('、') : value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value)});
				});
			}
			const body = stage.createDiv('markdown-rendered douban-template-preview-body');
			if (result.markdown.trim()) {
				await MarkdownRenderer.renderMarkdown(result.markdown, body, this.options.sourcePath || '', component);
			} else {
				body.createEl('p', {cls: 'douban-template-preview-empty', text: i18nHelper.getMessage('templatePreviewEmpty')});
			}
			if (!this.opened || revision !== this.revision) { component.unload(); return; }
			const scrollTop = this.previewEl.scrollTop;
			this.previewComponent?.unload();
			this.previewComponent = component;
			this.previewEl.replaceChildren(stage);
			this.previewEl.scrollTop = scrollTop;
			this.statusEl.setText(i18nHelper.getMessage('templatePreviewUpdated'));
		} catch (error) {
			component.unload();
			if (!this.opened || revision !== this.revision) return;
			this.statusEl.setText(i18nHelper.getMessage('templatePreviewFailed'));
			this.previewComponent?.unload();
			this.previewEl.empty();
			this.previewEl.createDiv({cls: 'douban-template-preview-warning', text: error instanceof Error ? error.message : String(error)});
		}
	}

	onClose(): void {
		this.opened = false;
		this.revision++;
		clearTimeout(this.timer);
		this.previewComponent?.unload();
		this.contentEl.empty();
	}
}
