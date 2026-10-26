import {App, TFile} from 'obsidian';
import {i18nHelper} from '../../lang/helper';

export class HeadingSelectModal {
	heading: string = '';

	private app: App;
	private file: TFile;
	private modalEl: HTMLElement | null = null;
	private inputEl: HTMLInputElement | null = null;
	private resolveFn: ((heading: string) => void) | null = null;

	constructor(app: App, file: TFile) {
		this.app = app;
		this.file = file;
	}

	open(): Promise<string> {
		return new Promise<string>(async (resolve) => {
			this.resolveFn = resolve;

			const content = await this.app.vault.read(this.file);
			const headings = this.extractHeadings(content);

			// Create modal overlay
			this.modalEl = document.body.createDiv({cls: 'modal-container'});
			this.modalEl.style.zIndex = '10000';

			const bg = this.modalEl.createDiv({cls: 'modal-bg'});
			bg.addEventListener('click', () => this.close());

			const modal = this.modalEl.createDiv({cls: 'modal'});

			const title = modal.createEl('h3', {text: i18nHelper.getMessage('130141')});

			const inputContainer = modal.createDiv();
			this.inputEl = inputContainer.createEl('input', {
				type: 'text',
				attr: {placeholder: i18nHelper.getMessage('130142')},
			});
			this.inputEl.style.width = '100%';
			this.inputEl.style.marginBottom = '8px';

			if (headings.length > 0) {
				const list = modal.createDiv({cls: 'suggestion-container'});
				list.style.maxHeight = '200px';
				list.style.overflow = 'auto';

				for (const heading of headings) {
					const item = list.createDiv({cls: 'suggestion-item'});
					item.setText(heading);
					item.style.padding = '4px 8px';
					item.style.cursor = 'pointer';
					item.style.fontSize = '13px';
					item.addEventListener('click', () => {
						this.heading = heading;
						this.close();
					});
					item.addEventListener('mouseenter', () => {
						item.addClass('is-selected');
					});
					item.addEventListener('mouseleave', () => {
						item.removeClass('is-selected');
					});
				}
			}

			const controls = modal.createDiv({cls: 'modal-button-container'});

			const skipBtn = controls.createEl('button', {text: i18nHelper.getMessage('110005')});
			skipBtn.addEventListener('click', () => {
				this.heading = this.inputEl?.value?.trim() || '';
				this.close();
			});

			const confirmBtn = controls.createEl('button', {text: i18nHelper.getMessage('110152')});
			confirmBtn.addClass('mod-cta');
			confirmBtn.addEventListener('click', () => {
				this.heading = this.inputEl?.value?.trim() || '';
				this.close();
			});

			this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					this.heading = this.inputEl?.value?.trim() || '';
					this.close();
				}
			});

			this.inputEl.focus();
		});
	}

	private close() {
		if (this.modalEl) {
			this.modalEl.remove();
			this.modalEl = null;
		}
		this.resolveFn?.(this.heading);
		this.resolveFn = null;
	}

	private extractHeadings(content: string): string[] {
		const headings: string[] = [];
		const lines = content.split('\n');
		for (const line of lines) {
			const match = line.match(/^#{1,6}\s+(.+)$/);
			if (match) {
				headings.push(match[1].trim());
			}
		}
		return headings;
	}
}
