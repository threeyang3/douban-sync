/**
 * 三步导入预览模态框
 *
 * Step 1: 条目总览（含勾选、属性管理）
 * Step 2: 属性差异对比
 * Step 3: 导入结果
 */

import { App, Modal, Setting, ButtonComponent } from 'obsidian';
import { i18nHelper } from '../../lang/helper';
import { UserDataImporter } from './UserDataImporter';
import {
	UserDataExport,
	EntryDiff,
	FieldStrategy,
	ImportResult,
	ImportAttributeSettings,
} from './types';

export class ImportPreviewModal extends Modal {
	private readonly importer: UserDataImporter;
	private importData: UserDataExport | null = null;
	private diffs: EntryDiff[] = [];
	private currentStep: 'overview' | 'diffs' | 'result' = 'overview';
	private importResult: ImportResult | null = null;

	// 属性管理
	private ignoredFieldsText = '';
	private fieldAliasesText = '';

	constructor(app: App) {
		super(app);
		this.importer = new UserDataImporter(app);
	}

	onOpen() {
		this.modalEl.addClass('import-preview-modal');
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

			this.rebuildDiffs();
			this.currentStep = 'overview';
			this.contentEl.empty();
			this.renderStep();
		};
		input.click();
	}

	private rebuildDiffs() {
		if (!this.importData) return;
		const settings = this.parseAttributeSettings();
		this.diffs = this.importer.buildDiffs(this.importData, settings);
	}

	private parseAttributeSettings(): ImportAttributeSettings {
		const ignoredFields = this.ignoredFieldsText
			.split('\n')
			.map(s => s.trim())
			.filter(s => s.length > 0);

		const fieldAliases: Record<string, string> = {};
		for (const line of this.fieldAliasesText.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			// 支持 "→" 和 "->" 两种分隔符
			const sep = trimmed.includes('→') ? '→' : '->';
			const parts = trimmed.split(sep).map(s => s.trim());
			if (parts.length === 2 && parts[0] && parts[1]) {
				fieldAliases[parts[0]] = parts[1];
			}
		}

		return { ignoredFields, fieldAliases };
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

	private getSelectedDiffs(): EntryDiff[] {
		return this.diffs.filter(d => d.selected);
	}

	// ── Step 1: 条目总览 ──

	private renderOverview() {
		const matched = this.diffs.filter(d => d.localFile !== null);
		const skipped = this.diffs.filter(d => d.localFile === null);

		this.contentEl.createEl('h3', { text: i18nHelper.getMessage('130240') });

		// 统计行 + 全选
		const statsRow = this.contentEl.createDiv({ cls: 'import-stats-row' });
		statsRow.createEl('p', {
			text: i18nHelper.getMessage('130241', this.diffs.length, matched.length, skipped.length),
			cls: 'import-stats-text',
		});
		const selectAllRow = statsRow.createDiv({ cls: 'import-select-all-row' });
		const selectAllCb = selectAllRow.createEl('input', { type: 'checkbox' });
		selectAllCb.checked = this.diffs.every(d => d.selected);
		selectAllCb.addEventListener('change', () => {
			const checked = selectAllCb.checked;
			for (const diff of this.diffs) {
				diff.selected = checked;
			}
			this.refreshListCheckboxes(checked);
			updateSelectedCount();
		});
		selectAllRow.createEl('label', { text: i18nHelper.getMessage('130263') });

		const selectedCountEl = this.contentEl.createDiv({ cls: 'import-selected-count' });

		const updateSelectedCount = () => {
			const count = this.diffs.filter(d => d.selected).length;
			selectedCountEl.setText(i18nHelper.getMessage('130265', count));
			// 更新全选状态
			selectAllCb.checked = this.diffs.length > 0 && this.diffs.every(d => d.selected);
			// 有无已选条目中有差异的
			const hasDiff = this.diffs.some(d => d.selected && d.localFile !== null && !d.identical);
			nextBtn.setDisabled(!hasDiff);
		};
		updateSelectedCount();

		// 条目列表
		const listEl = this.contentEl.createDiv({ cls: 'import-preview-list' });

		for (const diff of this.diffs) {
			const itemEl = listEl.createDiv({ cls: 'import-preview-item' });
			const hasLocal = diff.localFile !== null;

			// 勾选框
			const cb = itemEl.createEl('input', { type: 'checkbox' });
			cb.checked = diff.selected;
			cb.addEventListener('change', () => {
				diff.selected = cb.checked;
				updateSelectedCount();
			});

			const titleEl = itemEl.createSpan({ cls: 'import-preview-title', text: diff.title });
			if (!hasLocal) {
				titleEl.createSpan({ cls: 'import-preview-badge skip', text: i18nHelper.getMessage('130222') });
			} else if (diff.identical) {
				titleEl.createSpan({ cls: 'import-preview-badge identical', text: '=' });
			} else {
				titleEl.createSpan({ cls: 'import-preview-badge diff', text: `${diff.fieldDiffs.length}` });
			}

			itemEl.createSpan({ cls: 'import-preview-type', text: diff.type });
		}

		// 属性管理面板
		this.renderAttributeSettingsPanel();

		// 按钮
		const controls = this.contentEl.createDiv('controls');
		controls.addClass('obsidian_douban_search_controls');

		const nextBtn = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130242'))
			.setCta()
			.setDisabled(true)
			.onClick(() => {
				// 重新构建差异（应用属性管理设置）
				this.rebuildDiffs();
				// 保持勾选状态
				for (const diff of this.diffs) {
					if (diff.localFile === null || diff.identical) {
						diff.selected = false;
					}
				}
				this.currentStep = 'diffs';
				this.renderStep();
			})
			.setClass('obsidian_douban_search_button');

		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close())
			.setClass('obsidian_douban_cancel_button');
	}

	private refreshListCheckboxes(checked: boolean) {
		const listEl = this.contentEl.querySelector('.import-preview-list');
		if (!listEl) return;
		const cbs = listEl.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
		cbs.forEach(cb => { cb.checked = checked; });
	}

	// ── 属性管理面板 ──

	private renderAttributeSettingsPanel() {
		const panel = this.contentEl.createDiv({ cls: 'import-attr-panel' });

		const headerEl = panel.createDiv({ cls: 'import-attr-header' });
		const collapseIcon = headerEl.createSpan({ cls: 'import-attr-collapse-icon', text: '▸' });
		headerEl.createEl('span', { text: i18nHelper.getMessage('130260') });

		const bodyEl = panel.createDiv({ cls: 'import-attr-body' });
		bodyEl.hidden = true;

		headerEl.addEventListener('click', () => {
			const collapsed = bodyEl.hidden;
			bodyEl.hidden = !collapsed;
			collapseIcon.setText(collapsed ? '▾' : '▸');
		});

		// 忽略属性
		bodyEl.createEl('label', { text: i18nHelper.getMessage('130261') });
		const ignoredTa = bodyEl.createEl('textarea', {
			cls: 'import-attr-textarea',
			attr: { rows: '3', placeholder: 'fieldA\nfieldB' },
		});
		ignoredTa.value = this.ignoredFieldsText;
		ignoredTa.addEventListener('change', () => {
			this.ignoredFieldsText = ignoredTa.value;
		});

		// 属性别名
		bodyEl.createEl('label', { text: i18nHelper.getMessage('130262') });
		const aliasTa = bodyEl.createEl('textarea', {
			cls: 'import-attr-textarea',
			attr: { rows: '3', placeholder: '旧属性名 → 新属性名\nfieldA → fieldB' },
		});
		aliasTa.value = this.fieldAliasesText;
		aliasTa.addEventListener('change', () => {
			this.fieldAliasesText = aliasTa.value;
		});
	}

	// ── Step 2: 属性差异 ──

	private renderDiffs() {
		this.contentEl.createEl('h3', { text: i18nHelper.getMessage('130243') });

		const entriesWithDiffs = this.diffs.filter(d => d.selected && d.localFile !== null && !d.identical);
		const identicalEntries = this.diffs.filter(d => d.selected && d.localFile !== null && d.identical);

		for (const entry of entriesWithDiffs) {
			const entryEl = this.contentEl.createDiv({ cls: 'import-diff-entry' });
			const headerEl = entryEl.createDiv({ cls: 'import-diff-header' });
			headerEl.createEl('strong', { text: entry.title });
			const collapseEl = entryEl.createDiv({ cls: 'import-diff-body' });

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
