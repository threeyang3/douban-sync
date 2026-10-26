import {Setting} from "obsidian";
import SettingsManager from "./SettingsManager";
import {i18nHelper} from "../../lang/helper";
import {SupportType} from "../../constant/Constsant";

const SUPPORT_TYPES = [
	SupportType.all,
	SupportType.movie,
	SupportType.teleplay,
	SupportType.book,
	SupportType.music,
	SupportType.game,
	SupportType.theater,
	SupportType.note,
];

export function constructArrayLengthLimitSettingsUI(
	containerEl: HTMLElement,
	manager: SettingsManager,
): void {
	containerEl.createEl('h3', {text: i18nHelper.getMessage('1270')});
	containerEl.createEl('p', {text: i18nHelper.getMessage('1271')});
	containerEl.createEl('p', {text: i18nHelper.getMessage('1272')});

	const listEl = containerEl.createDiv('obsidian_douban_array_length_limits');
	const render = () => {
		listEl.empty();
		const limits = manager.plugin.settings.arrayLengthLimits || [];
		limits.forEach((limit, index) => {
			const setting = new Setting(listEl)
				.setName(`${i18nHelper.getMessage('127402')} ${index + 1}`)
				.addDropdown(dropdown => {
					SUPPORT_TYPES.forEach(type => {
						dropdown.addOption(type, i18nHelper.getMessage(type));
					});
					dropdown
						.setValue(limit.type || SupportType.all)
						.onChange(async value => {
							limits[index].type = value as SupportType;
							await manager.plugin.saveSettings();
						});
				})
				.addText(text => {
					text
						.setPlaceholder(i18nHelper.getMessage('127404'))
						.setValue(limit.field || '')
						.onChange(async value => {
							limits[index].field = value.trim();
							await manager.plugin.saveSettings();
						});
				})
				.addText(text => {
					text
						.setPlaceholder(i18nHelper.getMessage('127406'))
						.setValue(String(limit.limit ?? 0))
						.onChange(async value => {
							const parsed = Number(value);
							if (!Number.isInteger(parsed) || parsed < 0) {
								return;
							}
							limits[index].limit = parsed;
							await manager.plugin.saveSettings();
						});
					text.inputEl.type = 'number';
					text.inputEl.min = '0';
				})
				.addExtraButton(button => {
					button
						.setIcon('trash')
						.setTooltip(i18nHelper.getMessage('127407'))
						.onClick(async () => {
							await manager.removeArrayLengthLimit(index);
							render();
						});
				});
			setting.setDesc(i18nHelper.getMessage('127405'));
		});
	};

	new Setting(containerEl)
		.setName(i18nHelper.getMessage('1273'))
		.addButton(button => {
			button
				.setButtonText(i18nHelper.getMessage('127401'))
				.setIcon('plus')
				.onClick(async () => {
					await manager.addArrayLengthLimit();
					render();
				});
		});
	render();
}
