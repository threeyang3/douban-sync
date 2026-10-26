import {FuzzySuggestModal, TFile} from 'obsidian';
import DoubanPlugin from '../../main';
import {i18nHelper} from '../../lang/helper';

export class NoteSelectModal extends FuzzySuggestModal<TFile> {
	private allNotes: TFile[];
	private resolveFn: ((file: TFile | null) => void) | null = null;
	closed: Promise<TFile | null>;

	constructor(plugin: DoubanPlugin) {
		super(plugin.app);
		this.closed = new Promise<TFile | null>((resolve) => {
			this.resolveFn = resolve;
		});
		const folder = plugin.settings.noteDefaultFolder?.trim() || '';
		const allFiles = this.app.vault.getMarkdownFiles();
		if (folder) {
			const normalizedFolder = folder.replace(/\\/g, '/');
			this.allNotes = [...allFiles].sort((a, b) => {
				const aIn = a.path.replace(/\\/g, '/').startsWith(normalizedFolder) ? 0 : 1;
				const bIn = b.path.replace(/\\/g, '/').startsWith(normalizedFolder) ? 0 : 1;
				return aIn - bIn || a.path.localeCompare(b.path);
			});
		} else {
			this.allNotes = [...allFiles].sort((a, b) => a.path.localeCompare(b.path));
		}
		this.setPlaceholder(i18nHelper.getMessage('130140'));
	}

	getItems(): TFile[] {
		return this.allNotes;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile): void {
		this.resolveFn?.(item);
		this.resolveFn = null;
	}

	onClose(): void {
		this.resolveFn?.(null);
		this.resolveFn = null;
	}
}
