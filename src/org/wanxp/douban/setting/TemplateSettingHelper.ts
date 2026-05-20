import {i18nHelper} from "../../lang/helper";
import {ButtonComponent, SearchComponent, Setting, TFile} from "obsidian";
import SettingsManager from "./SettingsManager";
import {FileTreeSelectSuggest} from "./model/FileTreeSelectSuggest";
import {FolderTreeSelectSuggest} from "./model/FolderTreeSelectSuggest";
import {PathSuggest} from "./model/PathSuggest";
import {CreateTemplateSelectParams} from "./model/CreateTemplateSelectParams";
import {showFileExample} from "./OutputSettingsHelper";
import {TemplateKey} from "../../constant/Constsant";
import {Notice, normalizePath} from "obsidian";
import {TemplateConfig, TemplateSource, DoubanPluginSetting} from "./model/DoubanPluginSetting";
import {getDefaultTemplateContent} from "../../constant/DefaultTemplateContent";
import {TemplateEditorModal} from "../component/TemplateEditorModal";
import FileHandler from "../../file/FileHandler";
import {log} from "../../utils/Logutil";

const TEMPLATE_TYPES: Array<{nameKey: string, configKey: keyof DoubanPluginSetting, templateKey: TemplateKey}> = [
	{nameKey: '120101', configKey: 'movieTemplateConfig', templateKey: TemplateKey.movieTemplateFile},
	{nameKey: '120201', configKey: 'bookTemplateConfig', templateKey: TemplateKey.bookTemplateFile},
	{nameKey: '120301', configKey: 'musicTemplateConfig', templateKey: TemplateKey.musicTemplateFile},
	{nameKey: '120401', configKey: 'noteTemplateConfig', templateKey: TemplateKey.noteTemplateFile},
	{nameKey: '121301', configKey: 'gameTemplateConfig', templateKey: TemplateKey.gameTemplateFile},
	{nameKey: '121801', configKey: 'teleplayTemplateConfig', templateKey: TemplateKey.teleplayTemplateFile},
];

export function constructTemplateUI(containerEl: HTMLElement, manager: SettingsManager) {
	containerEl.createEl('p', { text: i18nHelper.getMessage('1204') });
	new Setting(containerEl).setDesc(i18nHelper.getMessage('1205'))

	for (const {nameKey, configKey, templateKey} of TEMPLATE_TYPES) {
		createTemplateSourceSetting(containerEl, manager, nameKey, configKey, templateKey);
	}

	containerEl.createEl('h3', { text: i18nHelper.getMessage('121920') });
	new Setting(containerEl)
		.setName(i18nHelper.getMessage('121924'))
		.setDesc(i18nHelper.getMessage('121925'))
		.addText((text) => {
			text
				.setPlaceholder('笔记')
				.setValue(manager.getSettingStr('noteDefaultFolder'))
				.onChange(async (value) => {
					await manager.updateSetting('noteDefaultFolder', value);
				});
			text.inputEl.style.width = '100%';
			new PathSuggest(manager.app, text.inputEl, 'folder');
		});

	new Setting(containerEl)
		.setName(i18nHelper.getMessage('121920'))
		.setDesc(i18nHelper.getMessage('121921'))
		.addText((text) => {
			text
				.setPlaceholder('笔记/{{type}}/{{title}}.md')
				.setValue(manager.getSettingStr('notePathTemplate'))
				.onChange(async (value) => {
					await manager.updateSetting('notePathTemplate', value);
				});
			text.inputEl.style.width = '100%';
		});

	new Setting(containerEl)
		.setName(i18nHelper.getMessage('121922'))
		.setDesc(i18nHelper.getMessage('121923'))
		.addTextArea((text) => {
			text
				.setPlaceholder('---\ndoubanId: {{id}}\ntitle: {{title}}\n---\n\n# {{title}}\n\n## 记录\n\n## 感想')
				.setValue(manager.getSettingStr('noteTemplateContent'))
				.onChange(async (value) => {
					await manager.updateSetting('noteTemplateContent', value);
				});
			text.inputEl.style.width = '100%';
			text.inputEl.style.minHeight = '150px';
		});
}

function createTemplateSourceSetting(
	containerEl: HTMLElement,
	manager: SettingsManager,
	nameKey: string,
	configKey: keyof DoubanPluginSetting,
	templateKey: TemplateKey
) {
	const getConfig = (): TemplateConfig => {
		const raw = manager.getSetting(configKey);
		if (raw && typeof raw === 'object' && 'source' in raw) {
			return raw as TemplateConfig;
		}
		// Auto-repair: if stored as a plain string (legacy/corrupted), treat as file path
		if (raw && typeof raw === 'string') {
			return { source: 'file', filePath: raw };
		}
		return { source: 'builtin' };
	};

	const setting = new Setting(containerEl);
	setting.setName(i18nHelper.getMessage(nameKey));
	setting.controlEl.addClass('obsidian_douban_template_file_select');

	// Source dropdown
	setting.addDropdown(dropdown => {
		dropdown
			.addOption('builtin', i18nHelper.getMessage('121940'))
			.addOption('file', i18nHelper.getMessage('121941'))
			.addOption('custom', i18nHelper.getMessage('121942'))
			.setValue(getConfig().source)
			.onChange(async (value: string) => {
				const config = getConfig();
				config.source = value as TemplateSource;
				await manager.updateSetting(configKey, config);
				refreshActionArea();
			});
		dropdown.selectEl.style.minWidth = '120px';
	});

	// Action area (container for context-dependent controls)
	const actionContainer = setting.controlEl.createDiv();
	actionContainer.style.display = 'inline-flex';
	actionContainer.style.alignItems = 'center';
	actionContainer.style.gap = '4px';

	const refreshActionArea = () => {
		actionContainer.empty();
		const config = getConfig();
		switch (config.source) {
			case 'builtin': {
				new ButtonComponent(actionContainer)
					.setIcon('eye')
					.setTooltip(i18nHelper.getMessage('121930'))
					.onClick(() => {
						const content = getDefaultBuiltinContent(templateKey);
						new TemplateEditorModal(manager.app, templateKey, content, {
							readOnly: true,
							onSaveAs: async (targetPath, latestContent) => {
								await saveTemplateContentAsFile(manager, targetPath, latestContent);
								await manager.updateSetting(configKey, { source: 'file', filePath: targetPath });
								refreshActionArea();
								new Notice(i18nHelper.getMessage('121945'));
							},
						}).open();
					});
				break;
			}
			case 'file': {
				const fileInput = actionContainer.createEl('input', {type: 'text'});
				fileInput.value = config.filePath || '';
				fileInput.placeholder = i18nHelper.getMessage('121701');
				fileInput.style.width = '200px';
				fileInput.style.fontSize = '12px';
				new FileTreeSelectSuggest(manager.app, fileInput, manager, configKey);
				fileInput.addEventListener('change', async () => {
					const cfg = getConfig();
					cfg.filePath = fileInput.value;
					await manager.updateSetting(configKey, cfg);
				});
				new ButtonComponent(actionContainer)
					.setIcon('eye')
					.setTooltip(i18nHelper.getMessage('121930'))
					.onClick(async () => {
						const content = await resolveTemplateContent(manager, templateKey, configKey);
						new TemplateEditorModal(manager.app, templateKey, content, {
							readOnly: true,
							onSaveAs: async (targetPath, latestContent) => {
								await saveTemplateContentAsFile(manager, targetPath, latestContent);
								new Notice(i18nHelper.getMessage('121945'));
							},
						}).open();
					});
				break;
			}
			case 'custom': {
				new ButtonComponent(actionContainer)
					.setIcon('pencil')
					.setTooltip(i18nHelper.getMessage('121931'))
					.onClick(() => {
						const cfg = getConfig();
						new TemplateEditorModal(
							manager.app,
							templateKey,
							cfg.customContent || getDefaultBuiltinContent(templateKey),
							{
								onSave: async (newContent) => {
									cfg.customContent = newContent;
									await manager.updateSetting(configKey, cfg);
								},
								onSaveAs: async (targetPath, latestContent) => {
									await saveTemplateContentAsFile(manager, targetPath, latestContent);
									await manager.updateSetting(configKey, { source: 'file', filePath: targetPath });
									refreshActionArea();
									new Notice(i18nHelper.getMessage('121945'));
								},
								onRestoreDefault: async () => {
									const defaultContent = getDefaultBuiltinContent(templateKey);
									cfg.customContent = defaultContent;
									await manager.updateSetting(configKey, cfg);
									return defaultContent;
								},
							}
						).open();
					});
				break;
			}
		}
	};

	// Copy button (always present)
	setting.addExtraButton(button => {
		button
			.setIcon('copy')
			.setTooltip(i18nHelper.getMessage('121903'))
			.onClick(async () => {
				const content = await resolveTemplateContent(manager, templateKey, configKey);
				navigator.clipboard.writeText(content);
				new Notice(i18nHelper.getMessage('121907'));
			});
	});

	setting.addExtraButton(button => {
		button
			.setIcon('reset')
			.setTooltip(i18nHelper.getMessage('121946'))
			.onClick(async () => {
				await manager.updateSetting(configKey, { source: 'builtin' });
				refreshActionArea();
				new Notice(i18nHelper.getMessage('121947'));
			});
	});

	refreshActionArea();
}

async function saveTemplateContentAsFile(
	manager: SettingsManager,
	targetPath: string,
	content: string,
) {
	try {
		const fileHandler = new FileHandler(manager.app);
		await fileHandler.writeTextFile(targetPath, content, false);
	} catch (error) {
		log.error('Failed to save template content as file', error);
		throw error;
	}
}

export async function resolveTemplateContent(
	manager: SettingsManager,
	templateKey: TemplateKey,
	configKey: keyof DoubanPluginSetting
): Promise<string> {
	const raw = manager.getSetting(configKey);
	let config: TemplateConfig;
	if (raw && typeof raw === 'object' && 'source' in raw) {
		config = raw as TemplateConfig;
	} else if (raw && typeof raw === 'string') {
		config = { source: 'file', filePath: raw };
	} else {
		config = { source: 'builtin' };
	}
	switch (config.source) {
		case 'builtin':
			return getDefaultBuiltinContent(templateKey);
		case 'file':
			if (config.filePath) {
				const file = manager.app.metadataCache.getFirstLinkpathDest(config.filePath, '');
				if (file) {
					const content = await manager.app.vault.read(file);
					if (content) return content;
				}
			}
			return getDefaultBuiltinContent(templateKey);
		case 'custom':
			return config.customContent || getDefaultBuiltinContent(templateKey);
		default:
			return getDefaultBuiltinContent(templateKey);
	}
}

function getDefaultBuiltinContent(templateKey: TemplateKey): string {
	return getDefaultTemplateContent(templateKey, true);
}

export function createFolderSelectionSetting({
											  name, desc, placeholder, key, manager,
										  }: CreateTemplateSelectParams, filePathDisplayExample?:HTMLDivElement) {
	return (setting: Setting) => {
		setting.setName(i18nHelper.getMessage(name));
		setting.setDesc(i18nHelper.getMessage(desc));
	};
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
