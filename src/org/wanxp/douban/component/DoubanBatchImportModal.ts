import {App, ButtonComponent, Modal, Notice, TextAreaComponent} from "obsidian";
import DoubanPlugin from "../../main";
import HandleContext from "../data/model/HandleContext";
import {i18nHelper} from "../../lang/helper";
import DoubanUrlUtil, {ParsedDoubanUrlBatch} from "../../utils/DoubanUrlUtil";
import {sleepRange} from "../../utils/TimeUtil";
import {BasicConst, SubjectHandledStatus} from "../../constant/Constsant";

interface BatchFailure {
	url: string;
	reason: string;
}

export default class DoubanBatchImportModal extends Modal {
	private value = '';
	private running = false;
	private cancelRequested = false;
	private textarea: TextAreaComponent;
	private progressEl: HTMLElement;
	private summaryEl: HTMLElement;
	private startButton: ButtonComponent;
	private cancelButton: ButtonComponent;

	constructor(
		app: App,
		private readonly plugin: DoubanPlugin,
		private readonly context: HandleContext,
	) {
		super(app);
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('obsidian_douban_batch_import');
		contentEl.createEl('h2', {text: i18nHelper.getMessage('batchImportTitle')});
		contentEl.createEl('p', {text: i18nHelper.getMessage('batchImportDesc')});

		this.textarea = new TextAreaComponent(contentEl)
			.setPlaceholder('https://movie.douban.com/subject/3742360/\nhttps://book.douban.com/subject/2567698/')
			.onChange(value => {
				this.value = value;
			});
		this.textarea.inputEl.rows = 10;
		this.textarea.inputEl.addClass('obsidian_douban_batch_urls');

		const controls = contentEl.createDiv('obsidian_douban_batch_controls');
		this.startButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('batchImportStart'))
			.setCta()
			.onClick(() => void this.startImport());
		this.cancelButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => {
				if (this.running) {
					this.cancelRequested = true;
					this.cancelButton.setButtonText(i18nHelper.getMessage('batchImportStopping'));
				} else {
					this.close();
				}
			});
		this.progressEl = contentEl.createDiv('obsidian_douban_batch_progress');
		this.summaryEl = contentEl.createDiv('obsidian_douban_batch_summary');
	}

	onClose(): void {
		this.cancelRequested = true;
		this.contentEl.empty();
	}

	private async startImport(): Promise<void> {
		if (this.running) {
			return;
		}
		this.running = true;
		this.cancelRequested = false;
		this.startButton.setDisabled(true);
		this.cancelButton.setButtonText(i18nHelper.getMessage('batchImportStop'));
		this.summaryEl.empty();

		const lines = this.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
		const parsed = DoubanUrlUtil.parseLines(lines);
		const failures: BatchFailure[] = [
			...parsed.invalid.map(url => ({url, reason: i18nHelper.getMessage('batchImportInvalidUrl')})),
			...parsed.duplicates.map(url => ({url, reason: i18nHelper.getMessage('batchImportDuplicateUrl')})),
		];
		let success = 0;
		let completedItems = 0;

		for (let index = 0; index < parsed.items.length; index++) {
			if (this.cancelRequested) {
				break;
			}
			const item = parsed.items[index];
			this.setProgress(i18nHelper.getMessage('batchImportProgress', index + 1, parsed.items.length));
			this.plugin.showStatus(i18nHelper.getMessage('batchImportProgress', index + 1, parsed.items.length));
			const itemContext: HandleContext = {
				...this.context,
				showAfterCreate: this.plugin.settings.showAfterCreate,
				syncActive: false,
				importError: '',
			};
			try {
				const result = await this.plugin.doubanExtractHandler.handleUrl(item, itemContext);
				if (result?.handledStatus === SubjectHandledStatus.saved) {
					success++;
				} else {
					failures.push({
						url: item.url,
						reason: itemContext.importError || i18nHelper.getMessage('batchImportFailed'),
					});
				}
			} catch (error) {
				failures.push({
					url: item.url,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
			completedItems++;
			if (index < parsed.items.length - 1) {
				await sleepRange(
					BasicConst.CALL_DOUBAN_DELAY,
					BasicConst.CALL_DOUBAN_DELAY + BasicConst.CALL_DOUBAN_DELAY_RANGE,
				);
			}
		}

		const cancelled = this.cancelRequested;
		const remaining = cancelled ? Math.max(0, parsed.items.length - completedItems) : 0;
		const summary = i18nHelper.getMessage(
			'batchImportSummary',
			success,
			failures.length + remaining,
			cancelled ? `${i18nHelper.getMessage('batchImportCancelled')}\n` : '',
		);
		this.setProgress(summary);
		this.renderFailures(failures, remaining);
		new Notice(summary);
		this.plugin.clearStatusBarDelay();
		this.running = false;
		this.startButton.setDisabled(false);
		this.cancelButton.setButtonText(i18nHelper.getMessage('110005'));
	}

	private setProgress(message: string): void {
		this.progressEl.setText(message);
	}

	private renderFailures(failures: BatchFailure[], remaining: number): void {
		if (failures.length === 0 && remaining === 0) {
			return;
		}
		this.summaryEl.createEl('h3', {text: i18nHelper.getMessage('batchImportFailures')});
		failures.forEach(failure => {
			this.summaryEl.createEl('p', {text: `${failure.url}\n${failure.reason}`});
		});
		if (remaining > 0) {
			this.summaryEl.createEl('p', {
				text: i18nHelper.getMessage('batchImportRemaining', remaining),
			});
		}
	}
}
