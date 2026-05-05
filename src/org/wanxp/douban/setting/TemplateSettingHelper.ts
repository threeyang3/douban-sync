import {i18nHelper} from "../../lang/helper";
import {CreateTemplateSelectParams} from "./model/CreateTemplateSelectParams";
import {SearchComponent, Setting, TFile} from "obsidian";
import SettingsManager from "./SettingsManager";
import {showFileExample} from "./OutputSettingsHelper";
import {FileTreeSelectSuggest} from "./model/FileTreeSelectSuggest";
import {FolderTreeSelectSuggest} from "./model/FolderTreeSelectSuggest";
import {
	BUILT_IN_TEMPLATE_PRESET_RECORDS,
	BuiltInTemplatePresetType,
	getBuiltInTemplateDefaultPath,
	getBuiltInTemplatePresetContent
} from "./TemplatePresetUtil";
import {TemplateKey} from "../../constant/Constsant";
import {Notice, normalizePath} from "obsidian";


export function constructTemplateUI(containerEl: HTMLElement, manager: SettingsManager) {
	// containerEl.createEl('h3', { text: i18nHelper.getMessage('1203') });
	containerEl.createEl('p', { text: i18nHelper.getMessage('1204') });
	new Setting(containerEl).setDesc(i18nHelper.getMessage('1205'))

	new Setting(containerEl).then(createFileSelectionSetting({containerEl: containerEl, name: '120101', desc: '120102', placeholder: '121701', key: 'movieTemplateFile', manager: manager}));
	new Setting(containerEl).then(createFileSelectionSetting({containerEl: containerEl, name: '120201', desc: '120202', placeholder: '121701', key: 'bookTemplateFile', manager: manager}));
	new Setting(containerEl).then(createFileSelectionSetting({containerEl: containerEl, name: '120301', desc: '120302', placeholder: '121701', key: 'musicTemplateFile', manager: manager}));
	new Setting(containerEl).then(createFileSelectionSetting({containerEl: containerEl, name: '120401', desc: '120402', placeholder: '121701', key: 'noteTemplateFile', manager: manager}));
	new Setting(containerEl).then(createFileSelectionSetting({containerEl: containerEl, name: '121301', desc: '121302', placeholder: '121701', key: 'gameTemplateFile', manager: manager}));
	new Setting(containerEl).then(createFileSelectionSetting({containerEl: containerEl, name: '121801', desc: '121802', placeholder: '121701', key: 'teleplayTemplateFile', manager: manager}));
}

export function createFileSelectionSetting({containerEl, name, desc, placeholder, key, manager
										  }: CreateTemplateSelectParams) {
	return (setting: Setting) => {
		const templateKey = key as TemplateKey;
		let preset: BuiltInTemplatePresetType = 'sync';
		setting.controlEl.addClass('obsidian_douban_template_file_select');
		// @ts-ignore
		setting.setName(i18nHelper.getMessage(name));
		// settingDesc.setDesc(i18nHelper.getMessage(desc));
		setting.addSearch(async (search: SearchComponent) => {
			const [oldValue, defaultVal] = manager.getSettingWithDefault(key);
			let v = defaultVal;
			if (oldValue) {
				v = oldValue;
			}
			const fileTreeSelectSuggest = new FileTreeSelectSuggest(manager.app, search.inputEl, manager, key);
			// @ts-ignore
			search.setValue(v);
			// @ts-ignore
			search.setPlaceholder(i18nHelper.getMessage(placeholder));
			search.inputEl.addClass('obsidian_douban_template_file_select_input');
			search.inputEl.style.width = '100%';
			search.onChange(async (value: string) => {
					manager.updateSetting(key, value);
				});

		});

		setting.addExtraButton((button) => {
			button
				.setIcon('copy')
				.setTooltip(i18nHelper.getMessage('121903'))
				.onClick(async () => {
					// @ts-ignore
					navigator.clipboard.writeText(getBuiltInTemplatePresetContent(templateKey, preset))
					new Notice(i18nHelper.getMessage('121907'));
				});
		});
		setting.addExtraButton((button) => {
			button
				.setIcon('document')
				.setTooltip(i18nHelper.getMessage('121901'))
				.onClick(async () => {
					await writeBuiltInTemplateFile(manager, key as TemplateKey, preset);
				});
		});
		const presetSetting = new Setting(containerEl)
			.setName(i18nHelper.getMessage('121908'))
			.setDesc(i18nHelper.getMessage('121909'));
		presetSetting.addDropdown((dropdown) => {
			Object.entries(BUILT_IN_TEMPLATE_PRESET_RECORDS).forEach(([value, label]) => {
				dropdown.addOption(value, i18nHelper.getMessage(label));
			});
			dropdown.setValue(preset).onChange((value: BuiltInTemplatePresetType) => {
				preset = value;
			});
		});

	};
}

export function createFolderSelectionSetting({
											  name, desc, placeholder, key, manager,
										  }: CreateTemplateSelectParams, filePathDisplayExample?:HTMLDivElement) {
	return (setting: Setting) => {
		// @ts-ignore
		setting.setName( i18nHelper.getMessage(name));
		// @ts-ignore
		setting.setDesc( i18nHelper.getMessage(desc));
	};
}

async function writeBuiltInTemplateFile(manager: SettingsManager, key: TemplateKey, preset: BuiltInTemplatePresetType) {
	const currentPath = manager.getSettingStr(key);
	const targetPath = normalizePath(currentPath || getBuiltInTemplateDefaultPath(key, preset));
	const fileExists = await manager.app.vault.adapter.exists(targetPath);
	if (fileExists) {
		const confirmed = window.confirm(i18nHelper.getMessage('121910', targetPath));
		if (!confirmed) {
			return;
		}
	}
	const content = getBuiltInTemplatePresetContent(key, preset);
	const file = manager.app.vault.getAbstractFileByPath(targetPath);
	if (file instanceof TFile) {
		await manager.app.vault.modify(file, content);
	} else {
		const pathParts = targetPath.split('/');
		pathParts.pop();
		const folder = pathParts.join('/');
		if (folder) {
			await ensureFolderExists(manager, folder);
		}
		await manager.app.vault.create(targetPath, content);
	}
	await manager.updateSetting(key, targetPath);
	new Notice(i18nHelper.getMessage('121911', targetPath));
}

async function ensureFolderExists(manager: SettingsManager, folder: string) {
	const normalizedFolder = normalizePath(folder);
	if (!normalizedFolder || await manager.app.vault.adapter.exists(normalizedFolder)) {
		return;
	}
	const parts = normalizedFolder.split('/').filter((part) => !!part);
	let currentPath = '';
	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;
		if (!await manager.app.vault.adapter.exists(currentPath)) {
			await manager.app.vault.createFolder(currentPath);
		}
	}
}



export function createFolderSelectionSettingInput({
																							 name, desc, placeholder, key, manager,
																						 }: CreateTemplateSelectParams, filePathDisplayExample?:HTMLDivElement) {
	return (setting: Setting) => {
		setting.controlEl.addClass('obsidian_douban_template_file_select');
		setting.addSearch(async (search: SearchComponent) => {
			const [oldValue, defaultVal] = manager.getSettingWithDefault(key);
			let v = defaultVal;
			if (oldValue) {
				v = oldValue;
			}
			new FolderTreeSelectSuggest(manager.app, search.inputEl);
			search.inputEl.addClass('obsidian_douban_template_file_select_input');
			search.inputEl.style.width = '100%';
			// @ts-ignore
			search.setValue(v)
				// @ts-ignore
				.setPlaceholder(i18nHelper.getMessage(placeholder))
				.onChange(async (value: string) => {
					manager.updateSetting(key, value);
					if (filePathDisplayExample) {
						showFileExample(filePathDisplayExample, manager);
					}
				});
		});
	};
}

