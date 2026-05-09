/**
 * 三步导入预览模态框
 *
 * Step 1: 条目总览
 * Step 2: 属性差异对比
 * Step 3: 导入结果
 */

import { App, Modal, Setting, ButtonComponent, TFile } from 'obsidian';
import { i18nHelper } from '../../lang/helper';
import { UserDataImporter } from './UserDataImporter';
import { UserDataExport, EntryDiff, FieldDiff, FieldStrategy, ImportResult } from './types';

export class ImportPreviewModal extends Modal {
	private readonly importer: UserDataImporter;
	private importData: UserDataExport | null = null;
	private diffs: EntryDiff[] = [];
	private currentStep: 'overview' | 'diffs' | 'result' = 'overview';
	private importResult: ImportResult | null = null;

	constructor(app: App) {
		super(app);
		this.importer = new UserDataImporter(app);
	}

	onOpen() {
		this.openFilePicker();
	}

	private openFilePicker() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.multiple = false;
		input.onchange = async () => {
			const files = input.files;
			if (!files || files.length === 0) return;

			const file = files[0];
			const content = await file.text();
			try {
				this.importData = this.importer.parseImportContent(file.name, content);
			} catch (error) {
				this.contentEl.createEl('p', {
					text: error instanceof Error ? error.message : String(error),
					cls: 'modal-error',
				});
				return;
			}

			this.diffs = this.importer.buildDiffs(this.importData);
			this.currentStep = 'overview';
			this.contentEl.empty();
			this.renderStep();
		};
		input.click();
	}

	private renderStep() {
		this.contentEl.empty();
		switch (this.currentStep) {
			case 'overview':
				this.renderOverview();
				break;
			case 'diffs':
				this.renderDiffs();
				break;
			case 'result':
				this.renderResult();
				break;
		}
	}

	// ── Step 1: 条目总览 ──

	private renderOverview() {
		const matched = this.diffs.filter(d => d.localFile !== null);
		const skipped = this.diffs.filter(d => d.localFile === null);

		this.contentEl.createEl('h3', { text: i18nHelper.getMessage('130240') });
		this.contentEl.createEl('p', {
			text: i18nHelper.getMessage('130241', this.diffs.length, matched.length, skipped.length),
		});

		const listEl = this.contentEl.createDiv({ cls: 'import-preview-list' });

		for (const diff of this.diffs) {
			const itemEl = listEl.createDiv({ cls: 'import-preview-item' });
			const hasLocal = diff.localFile !== null;

			const titleEl = itemEl.createSpan({ cls: 'import-preview-title', text: diff.title });
			if (!hasLocal) {
				titleEl.createSpan({ cls: 'import-preview-badge skip', text: i18nHelper.getMessage('130222') });
			} else if (diff.identical) {
				titleEl.createSpan({ cls: 'import-preview-badge identical', text: '=' });
			} else {
				titleEl.createSpan({ cls: 'import-preview-badge diff', text: `${diff.fieldDiffs.length}` });
			}

			const typeEl = itemEl.createSpan({ cls: 'import-preview-type', text: diff.type });
			const propsCount = diff.fieldDiffs.length;
			if (hasLocal && !diff.identical) {
				itemEl.createSpan({ cls: 'import-preview-props', text: `${propsCount}` });
			}
		}

		const controls = this.contentEl.createDiv('controls');
		controls.addClass('obsidian_douban_search_controls');

		const hasDiff = matched.some(d => !d.identical);
		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130242'))
			.setCta()
			.setDisabled(!hasDiff)
			.onClick(() => {
				this.currentStep = 'diffs';
				this.renderStep();
			})
			.setClass('obsidian_douban_search_button');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close())
			.setClass('obsidian_douban_cancel_button');
	}

	// ── Step 2: 属性差异 ──

	private renderDiffs() {
		this.contentEl.createEl('h3', { text: i18nHelper.getMessage('130243') });

		const entriesWithDiffs = this.diffs.filter(d => d.localFile !== null && !d.identical);
		const identicalEntries = this.diffs.filter(d => d.localFile !== null && d.identical);

		for (const entry of entriesWithDiffs) {
			const entryEl = this.contentEl.createDiv({ cls: 'import-diff-entry' });
			const headerEl = entryEl.createDiv({ cls: 'import-diff-header' });
			headerEl.createEl('strong', { text: entry.title });
			const collapseEl = entryEl.createDiv({ cls: 'import-diff-body' });

			// 差异表格
			const tableEl = collapseEl.createEl('table', { cls: 'import-diff-table' });
			const thead = tableEl.createEl('thead');
			const headerRow = thead.createEl('tr');
			headerRow.createEl('th', { text: i18nHelper.getMessage('130252') });
			headerRow.createEl('th', { text: i18nHelper.getMessage('130250') });
			headerRow.createEl('th', { text: i18nHelper.getMessage('130251') });
			headerRow.createEl('th', { text: i18nHelper.getMessage('130243') });

			const tbody = tableEl.createEl('tbody');
			for (const diff of entry.fieldDiffs) {
				const row = tbody.createEl('tr');
				row.createEl('td', { text: diff.fieldName });
				row.createEl('td', { text: String(diff.localValue ?? '') });
				row.createEl('td', { text: String(diff.importValue ?? '') });

				const strategyCell = row.createEl('td');
				new Setting(strategyCell)
					.addDropdown(dropdown => {
						dropdown
							.addOption('keep_local', i18nHelper.getMessage('130244'))
							.addOption('overwrite', i18nHelper.getMessage('130245'))
							.addOption('smart_merge', i18nHelper.getMessage('130246'))
							.setValue(diff.strategy)
							.onChange((value) => {
								diff.strategy = value as FieldStrategy;
							});
					});
			}
		}

		// 一致的条目
		if (identicalEntries.length > 0) {
			const identicalEl = this.contentEl.createDiv({ cls: 'import-diff-identical' });
			identicalEl.createEl('p', {
				text: i18nHelper.getMessage('130248', identicalEntries.length),
			});
			const names = identicalEntries.map(e => e.title).join('、');
			identicalEl.createEl('p', {
				text: names,
				cls: 'import-diff-identical-names',
			});
		}

		const controls = this.contentEl.createDiv('controls');
		controls.addClass('obsidian_douban_search_controls');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130247'))
			.setCta()
			.onClick(() => this.doImport())
			.setClass('obsidian_douban_search_button');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close())
			.setClass('obsidian_douban_cancel_button');
	}

	// ── Step 3: 结果 ──

	private renderResult() {
		const result = this.importResult!;

		this.contentEl.createEl('h3', { text: i18nHelper.getMessage('130230') });

		const summary = this.contentEl.createDiv();
		summary.createEl('p', { text: i18nHelper.getMessage('130231', result.success) });
		summary.createEl('p', { text: i18nHelper.getMessage('130232', result.skipped) });

		if (result.errors.length > 0) {
			summary.createEl('p', { text: i18nHelper.getMessage('130233', result.errors.length) });
			const errorList = summary.createEl('ul');
			for (const err of result.errors.slice(0, 10)) {
				errorList.createEl('li', { text: `${err.title}: ${err.error}` });
			}
			if (result.errors.length > 10) {
				errorList.createEl('li', { text: `... ${result.errors.length - 10} more` });
			}
		}

		new ButtonComponent(this.contentEl)
			.setButtonText(i18nHelper.getMessage('110005'))
			.setCta()
			.onClick(() => this.close())
			.setClass('obsidian_douban_search_button');
	}

	// ── 执行导入 ──

	private async doImport() {
		this.currentStep = 'result';
		this.contentEl.empty();

		const progressEl = this.contentEl.createDiv();
		progressEl.setText(i18nHelper.getMessage('130203'));

		this.importResult = await this.importer.applyDiffs(this.diffs, (current, total) => {
			progressEl.setText(i18nHelper.getMessage('130204', current, total));
		});

		progressEl.remove();
		this.renderStep();
	}

	onClose() {
		this.contentEl.empty();
	}
}
