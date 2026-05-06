import {App, TAbstractFile, TFile, TFolder} from "obsidian";
import {TextInputSuggest} from "./TextInputSuggest";

export type PathSuggestMode = 'folder' | 'file';

export class PathSuggest extends TextInputSuggest<TAbstractFile> {
	private mode: PathSuggestMode;

	constructor(app: App, inputEl: HTMLInputElement, mode: PathSuggestMode = 'folder') {
		super(app, inputEl);
		this.mode = mode;
	}

	getSuggestions(inputStr: string): TAbstractFile[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const results: TAbstractFile[] = [];
		const lowerCaseInputStr = inputStr.toLowerCase();

		abstractFiles.forEach((file: TAbstractFile) => {
			if (this.mode === 'folder') {
				if (file instanceof TFolder && file.path.toLowerCase().contains(lowerCaseInputStr)) {
					results.push(file);
				}
			} else {
				if (file instanceof TFile && file.extension === "md" && file.path.toLowerCase().contains(lowerCaseInputStr)) {
					results.push(file);
				}
			}
		});

		return results;
	}

	renderSuggestion(item: TAbstractFile, el: HTMLElement): void {
		el.setText(item.path);
	}

	selectSuggestion(item: TAbstractFile): void {
		this.inputEl.value = item.path;
		this.inputEl.trigger("input");
		this.close();
	}
}
