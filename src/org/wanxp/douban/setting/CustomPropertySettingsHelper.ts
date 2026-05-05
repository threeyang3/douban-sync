import {i18nHelper} from "../../lang/helper";
import SettingsManager from "./SettingsManager";
import {CustomProperty} from "./model/CustomProperty";
import {ButtonComponent, DropdownComponent, Notice, Setting, TextComponent} from "obsidian";
import {SupportType, SupportTypeMap} from "../../constant/Constsant";
import DoubanPlugin from "../../main";
import {
	buildCustomPropertyExportData,
	CustomPropertyImportMode,
	importCustomProperties,
	parseCustomPropertyImportJson
} from "./CustomPropertyIO";

export function constructCustomPropertySettingsUI(containerEl: HTMLElement, manager: SettingsManager) {
	// containerEl.createEl('h3', { text: i18nHelper.getMessage('1240') });
	containerEl.createEl('p', { text: i18nHelper.getMessage('1242') });
	const customProperties = manager.plugin.settings.customProperties;
	const list = containerEl.createDiv('custom-property-list');
	new Setting(containerEl)
		.setDesc(i18nHelper.getMessage('1241'))
		.addButton((button) => {
			button.setButtonText(i18nHelper.getMessage('124101'));
			button.setTooltip(i18nHelper.getMessage('124101'));
			button.setIcon('plus');
			button.onClick(async () => {
				customProperties.push({name: '', value: '', field: SupportType.all});
				constructCustomPropertyUI(list, customProperties, manager);
			});
		})
		.addButton((button) => {
			button.setButtonText(i18nHelper.getMessage('124201'));
			button.setTooltip(i18nHelper.getMessage('124202'));
			button.onClick(async () => {
				await exportCustomProperties(manager.plugin, customProperties);
			});
		})
		.addButton((button) => {
			button.setButtonText(i18nHelper.getMessage('124203'));
			button.setTooltip(i18nHelper.getMessage('124204'));
			button.onClick(async () => {
				await importCustomPropertiesFromFile(manager, list, 'merge');
			});
		})
		.addButton((button) => {
			button.setButtonText(i18nHelper.getMessage('124205'));
			button.setTooltip(i18nHelper.getMessage('124206'));
			button.onClick(async () => {
				await importCustomPropertiesFromFile(manager, list, 'overwrite');
			});
		});
	constructCustomPropertyUI(list, customProperties, manager);
}

export function constructCustomPropertyUI(containerEl: HTMLElement, customProperties: CustomProperty[], manager: SettingsManager) {
	containerEl.empty();
	for(let i: number = 0; i < customProperties.length; i++) {
		addFilterInput(customProperties[i], containerEl, customProperties, manager, i);
	}
}



function addFilterInput(data: CustomProperty, el: HTMLElement, customProperties: CustomProperty[] , manager: SettingsManager, idx: number) {
	const item = el.createEl('li')
	item.createEl('span', { text: i18nHelper.getMessage('124102') })
	const nameField = new TextComponent(el);
	nameField.setPlaceholder(i18nHelper.getMessage('124103'))
		.setValue(data.name)
		.onChange(async (value) => {
			customProperties[idx].name = value;
			await manager.plugin.saveSettings();
		});
	let nameEl = nameField.inputEl;
	nameEl.addClass('obsidian_douban_settings_input')
	item.appendChild(nameEl);


	item.createEl('span', { text: i18nHelper.getMessage('124104') })
	const  valueField = new TextComponent(el);
	valueField.setPlaceholder(i18nHelper.getMessage('124105'))
		.setValue(data.value)
		.onChange(async (value) => {
			customProperties[idx].value = value;
			await manager.plugin.saveSettings();
		});
	const valueEl = valueField.inputEl;
	valueEl.addClass('obsidian_douban_settings_input')
	item.appendChild(valueEl);

	const fieldsDropdown = new DropdownComponent(el);
	for (const fieldSelect in SupportType) {
		fieldsDropdown.addOption(fieldSelect, i18nHelper.getMessage(fieldSelect));
	}
	item.createEl('span', { text: i18nHelper.getMessage('124106') });
	let dataFieldValue = data.field;
	if(typeof dataFieldValue === 'string') {
		// @ts-ignore
		dataFieldValue = SupportTypeMap[dataFieldValue];
	}
	fieldsDropdown.setValue(dataFieldValue)
		.onChange(async (value: SupportType) => {
			customProperties[idx].field = value;
			await manager.plugin.saveSettings();
		});
	const fieldSelectEl = fieldsDropdown.selectEl;
	fieldSelectEl.addClass('obsidian_douban_settings_input')
	item.appendChild(fieldSelectEl);

	const extractButton = new ButtonComponent(el);
	extractButton.setIcon('minus-with-circle');
	extractButton.setTooltip(i18nHelper.getMessage('124107'));
	extractButton.onClick(async () => {
		customProperties.splice(idx, 1);
		constructCustomPropertyUI(el, customProperties, manager);
		await manager.plugin.saveSettings();
	});
	const extractButtonEl = extractButton.buttonEl;
	extractButtonEl.addClass('obsidian_douban_settings_button')
	item.appendChild(extractButtonEl);
	// item.appendChild(extractButton.extraSettingsEl);
}

async function exportCustomProperties(plugin: DoubanPlugin, customProperties: CustomProperty[]) {
	const exportData = buildCustomPropertyExportData(customProperties);
	const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `obsidian-douban-custom-properties-${new Date().toISOString().slice(0, 10)}.json`;
	link.click();
	URL.revokeObjectURL(url);
	new Notice(i18nHelper.getMessage('124207'));
}

async function importCustomPropertiesFromFile(
	manager: SettingsManager,
	list: HTMLElement,
	mode: CustomPropertyImportMode,
) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.json,application/json';
	input.multiple = false;
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) {
			return;
		}
		try {
			const content = await file.text();
			const importData = parseCustomPropertyImportJson(content);
			manager.plugin.settings.customProperties = importCustomProperties(
				manager.plugin.settings.customProperties || [],
				importData,
				mode,
			);
			await manager.plugin.saveSettings();
			constructCustomPropertyUI(list, manager.plugin.settings.customProperties, manager);
			new Notice(i18nHelper.getMessage(mode === 'merge' ? '124208' : '124209'));
		} catch (e) {
			new Notice(i18nHelper.getMessage('124210'));
		}
	};
	input.click();
}
