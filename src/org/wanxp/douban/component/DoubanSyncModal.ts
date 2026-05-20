import {
	App,
	ButtonComponent, DropdownComponent,
	Modal, Notice, SearchComponent, Setting, TextComponent, ValueComponent,
} from "obsidian";

import DoubanPlugin from "../../main";
import {TemplateConfig} from "../setting/model/DoubanPluginSetting";
import {i18nHelper} from "src/org/wanxp/lang/helper";
import HandleContext from "../data/model/HandleContext";
import {
	DEFAULT_SETTINGS_ARRAY_INPUT_SIZE,
	SupportType, SyncConditionType,
	SyncConditionTypeRecords,
	SyncType,
	SyncTypeRecords
} from "../../constant/Constsant";
import {
	ALL, DoubanSubjectState, DoubanSubjectStateRecords,
	DoubanSubjectStateRecords_BOOK_SYNC,
	DoubanSubjectStateRecords_BROADCAST_SYNC, DoubanSubjectStateRecords_GAME_SYNC,
	DoubanSubjectStateRecords_MOVIE_SYNC,
	DoubanSubjectStateRecords_MUSIC_SYNC,
	DoubanSubjectStateRecords_NOTE_SYNC,
	DoubanSubjectStateRecords_TELEPLAY_SYNC
} from "../../constant/DoubanUserState";
import {SyncConfig} from "../sync/model/SyncConfig";
import {clearInterval} from "timers";
import {PathSuggest} from "../setting/model/PathSuggest";
import {DEFAULT_SETTINGS} from "../../constant/DefaultSettings";
import {getDefaultTemplateContent} from "../../constant/DefaultTemplateContent";
import TimeUtil from "../../utils/TimeUtil";
import SettingsManager from "../setting/SettingsManager";
import {ArraySetting, DEFAULT_SETTINGS_ARRAY_NAME} from "../setting/model/ArraySetting";
import {arraySettingDisplay} from "../setting/ArrayDisplayTypeSettingsHelper";
import {DatePickComponent} from "./DatePickComponent";
import {NumberComponent} from "./NumberComponent";
import {log} from "../../utils/Logutil";
import {SyncPreviewHandler} from "../sync/handler/SyncPreviewHandler";
import {SyncPreviewModal} from "./SyncPreviewModal";

export class DoubanSyncModal extends Modal {
	plugin: DoubanPlugin;
	context: HandleContext
	timer: any;

	constructor(app: App, plugin: DoubanPlugin, context: HandleContext) {
		super(app);
		this.plugin = plugin;
		this.context = context;
	}

	onOpen() {
		let {contentEl} = this;
		this.show(contentEl);
	}

	private show(contentEl: HTMLElement) {
		contentEl.empty();
		if (this.plugin.statusHolder.syncing()) {
			this.showSyncStatus(contentEl);
		} else {
			this.showSyncConfig(contentEl);
		}
	}

	private showSyncStatus(contentEl: HTMLElement) {
		const {syncStatus} = this.plugin.statusHolder;
		const {syncConfig} = syncStatus;
		contentEl.createEl("h3", {text: i18nHelper.getMessage('500002')});

		this.showConfigPan(contentEl.createDiv('config'), syncConfig, true);

		const sliderDiv = contentEl.createEl('div');
		sliderDiv.addClass('obsidian_douban_sync_slider');
		const controls = contentEl.createDiv("controls");

		const stopButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110009'))
			.onClick(async () => {
				this.close();
				await this.plugin.statusHolder.stopSync();
			})

		const backgroundButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110010'))
			.onClick(() => {
				this.close();
			});

		this.showProgress(sliderDiv, backgroundButton, stopButton);

		this.timer = setInterval(() => {
			this.showProgress(sliderDiv,backgroundButton, stopButton);
		}, 1000);

		backgroundButton.setClass("obsidian_douban_status_button");
		stopButton.setClass("obsidian_douban_status_button");

	}


	private showProgress(sliderDiv: HTMLDivElement, backgroundButton:ButtonComponent, stopButton:ButtonComponent) {
		sliderDiv.empty();
		new Setting(sliderDiv);
		let progress = sliderDiv.createDiv('progress');
		const {syncStatus} = this.plugin.statusHolder;
		if (!this.plugin.statusHolder.syncStarted) {
			progress.innerHTML = `<p>
    <label for="file">${i18nHelper.getMessage('110033')}</label>
    <progress class="obsidian_douban_sync_slider" max="${syncStatus.getTotal() == 0 ? 1:syncStatus.getTotal()}" value="${syncStatus.getHasHandle()}"> </progress> <span> ${syncStatus.getHasHandle()}/${syncStatus.getTotal()}:${i18nHelper.getMessage('110036')}  </span>
</p>
<p>
<label for="file">${i18nHelper.getMessage('110092')}</label>
<span>${i18nHelper.getMessage('110090', syncStatus.getTypeName(), syncStatus.getScopeName(), syncStatus.getAllTotal(), syncStatus.getTotal())}</span>
</p>
<p>
<label for="file">${i18nHelper.getMessage('110091')}</label>
<span>${syncStatus.getMessage()}</span>
</p>
`
			backgroundButton.setDisabled(true);
			stopButton.setButtonText(i18nHelper.getMessage('110036'))
			return;
		}
		progress.innerHTML = `<p>
    <label for="file">${i18nHelper.getMessage('110033')}</label>
    <progress class="obsidian_douban_sync_slider" max="${syncStatus.getTotal() == 0 ? 1:syncStatus.getTotal()}" value="${syncStatus.getHasHandle()}"> </progress> <span> ${syncStatus.getTotal() == 0 ? i18nHelper.getMessage('110043') : syncStatus.getHasHandle() + '/' + syncStatus.getTotal()}
${syncStatus.getHandle() == 0? '...' : i18nHelper.getMessage('110042') + ':' + TimeUtil.estimateTimeMsg(syncStatus.getNeedHandled()-syncStatus.getHandle(), syncStatus.getOverSize())} </span>
</p>
<p>
<label for="file">${i18nHelper.getMessage('110092')}</label>
<span>${i18nHelper.getMessage('110090', syncStatus.getTypeName(), syncStatus.getScopeName(), syncStatus.getAllTotal(), syncStatus.getTotal())}</span>
</p>
<p>
<label for="file">${i18nHelper.getMessage('110091')}</label>
<span>${syncStatus.getMessage()}</span>
</p>
`}

	private showSyncConfig(contentEl: HTMLElement) {
		if (this.timer != null) {
			clearInterval(this.timer)
		}
		contentEl.createEl("h3", {text: i18nHelper.getMessage('500001')});
		const {settings} =  this.plugin;
		let syncConfig:SyncConfig = {syncType: SyncType.movie, scope: ALL,
			force: false,
			dataFilePath: (settings.dataFilePath == '' || settings.dataFilePath == null) ? DEFAULT_SETTINGS.dataFilePath : settings.dataFilePath,
			dataFileNamePath: (settings.dataFileNamePath == '' || settings.dataFileNamePath == null) ?  DEFAULT_SETTINGS.dataFileNamePath : settings.dataFileNamePath,
			cacheImage: ( settings.cacheImage == null) ?  DEFAULT_SETTINGS.cacheImage : settings.cacheImage,
			cacheHighQuantityImage: ( settings.cacheHighQuantityImage == null) ?  DEFAULT_SETTINGS.cacheHighQuantityImage : settings.cacheHighQuantityImage,
			overwriteCoverImage: ( settings.overwriteCoverImage == null) ?  DEFAULT_SETTINGS.overwriteCoverImage : settings.overwriteCoverImage,
			attachmentPath: (settings.attachmentPath == '' || settings.attachmentPath == null) ?  DEFAULT_SETTINGS.attachmentPath : settings.attachmentPath,
			attachmentFileName: (settings.attachmentFileName == '' || settings.attachmentFileName == null) ?  DEFAULT_SETTINGS.attachmentFileName : settings.attachmentFileName,
			templateFile:  this.getDefaultTemplatePath(SyncType.movie),
			incrementalUpdate: true,
			inheritOldFields: false,
			syncConditionType: SyncConditionType.ALL,
			syncConditionDateFromValue: TimeUtil.getLastMonth(),
			syncConditionDateToValue: new Date(),
			syncConditionCountFromValue: 1,
			syncConditionCountToValue: 30
		};
		this.showConfigPan(contentEl.createDiv('config'), syncConfig, false);
		const controls = contentEl.createDiv("controls");
		const cancelButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => {
				this.close();
			});
		const previewButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('130300'))
			.onClick(async () => {
				if(!await this.plugin.checkLogin(this.context)) {
					return;
				}
				previewButton.setDisabled(true);
				try {
					await this.showPreview(syncConfig, contentEl, syncButton);
				} finally {
					previewButton.setDisabled(false);
				}
			});
		const syncButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110007'))
			.onClick(async () => {
				if(!await this.plugin.checkLogin(this.context)) {
					return;
				}
				if (syncConfig.force) {
					await this.showPreview(syncConfig, contentEl, syncButton, true);
					return;
				}
				await this.startSyncFlow(syncConfig, contentEl, syncButton);
			})


		syncButton.setClass("obsidian_douban_search_button");
		cancelButton.setClass("obsidian_douban_search_button");
		previewButton.setClass("obsidian_douban_search_button");

	}

	private async showPreview(syncConfig: SyncConfig, contentEl: HTMLElement, syncButton: ButtonComponent, allowStart:boolean = false) {
		try {
			const previewHandler = new SyncPreviewHandler(this.app, this.plugin);
			const previewResult = await previewHandler.preview(syncConfig, {
				...this.context,
				syncConfig,
				syncPreviewMode: true,
			});
			new SyncPreviewModal(this.app, previewResult, allowStart ? async () => {
				await this.startSyncFlow(syncConfig, contentEl, syncButton);
			} : undefined).open();
		} catch (error) {
			log.error('Failed to generate sync preview', error);
			new Notice(i18nHelper.getMessage('130311'));
		}
	}

	private async startSyncFlow(syncConfig: SyncConfig, contentEl: HTMLElement, syncButton: ButtonComponent) {
		syncButton.setDisabled(true);
		if(!this.plugin.statusHolder.startSync(syncConfig)) {
			syncButton.setDisabled(false);
			return;
		}
		this.updateContextByConfig(syncConfig);
		this.show(contentEl);
		await this.plugin.sync(this.context);
	}

	private updateContextByConfig(syncConfig: SyncConfig) {
		const { context} = this;
		context.syncConfig = syncConfig;
		context.syncActive = true;
	}

	private showConfigPan(contentEl: HTMLElement, config:SyncConfig, disable:boolean) {
		new Setting(contentEl);
		this.showTypeDropdown(contentEl, config, disable);
		this.showCondition(contentEl, config, disable);
		this.showUpdateAllConfig(contentEl, config, disable);
		const forceConfigContainer = contentEl.createDiv('sync-force-config');
		this.renderForceRelatedConfigs(forceConfigContainer, config, disable);
	}

	private renderForceRelatedConfigs(containerEl: HTMLElement, config: SyncConfig, disable:boolean) {
		containerEl.empty();
		this.showForceUpdateConfig(containerEl, config, disable, () => {
			this.renderForceRelatedConfigs(containerEl, config, disable);
		});
		this.showInheritOldFieldsConfig(containerEl, config, disable, () => {
			this.renderForceRelatedConfigs(containerEl, config, disable);
		});
	}

	async onClose() {
		let {contentEl} = this;
		contentEl.empty();
		if (this.timer != null) {
			clearInterval(this.timer);
		}
	}

	private openScopeDropdown(contentEl:HTMLDivElement, config: SyncConfig, disable:boolean) {
		switch (config.syncType) {
			case SyncType.movie:
				this.showScopeDropdown(contentEl, DoubanSubjectStateRecords_MOVIE_SYNC, config, disable);
				break;
			case SyncType.book:
				this.showScopeDropdown(contentEl, DoubanSubjectStateRecords_BOOK_SYNC, config, disable);
				break;
			case SyncType.broadcast:
				this.showScopeDropdown(contentEl, DoubanSubjectStateRecords_BROADCAST_SYNC, config, disable);
				break;
			case SyncType.note:
				this.showScopeDropdown(contentEl, DoubanSubjectStateRecords_NOTE_SYNC, config, disable);
				break;
			case SyncType.music:
				this.showScopeDropdown(contentEl, DoubanSubjectStateRecords_MUSIC_SYNC, config, disable);
				break;
			case SyncType.teleplay:
				this.showScopeDropdown(contentEl, DoubanSubjectStateRecords_TELEPLAY_SYNC, config, disable);
				break;
			case SyncType.game:
				config.scope = DoubanSubjectState.collect;
				this.showScopeDropdown(contentEl, DoubanSubjectStateRecords_GAME_SYNC, config, disable);
				break;
		}
	}

	private showTypeDropdown(containerEl:HTMLElement, config: SyncConfig, disable:boolean) {
		const settings = new Setting(containerEl);
		const scopeSelections = containerEl.createDiv("scope-selection");
		settings
			.setName(i18nHelper.getMessage('110030'))
			.addDropdown((dropdown) => {
				dropdown.addOptions(SyncTypeRecords)
					.setValue(config.syncType)
					.onChange((value) => {
						config.syncType = value;
						config.templateFile = this.getDefaultTemplatePath(value);
						this.openScopeDropdown(scopeSelections, config, disable);
					});
			}).setDisabled(disable);
		this.openScopeDropdown(scopeSelections, config, disable);
	}

	private getDefaultTemplatePath(value: string) {
		const {settings} = this.plugin;
		const raw: TemplateConfig | string | undefined =
			value === SyncType.movie ? settings.movieTemplateConfig :
			value === SyncType.book ? settings.bookTemplateConfig :
			value === SyncType.music ? settings.musicTemplateConfig :
			value === SyncType.teleplay ? settings.teleplayTemplateConfig :
			value === SyncType.game ? settings.gameTemplateConfig :
			undefined;
		if (!raw) return '';
		if (typeof raw === 'string') return raw;
		if (raw.source === 'file' && raw.filePath) return raw.filePath;
		return '';
	}

	private showScopeDropdown(containerEl:HTMLDivElement, scopeSelections: Record<string, string>, config: SyncConfig, disable:boolean) {
		containerEl.empty();
		new Setting(containerEl)
			.setName(i18nHelper.getMessage('110032'))
			.addDropdown((dropdown) => {
				dropdown.addOptions(scopeSelections)
				dropdown.setValue(config.scope)
					.onChange(async (value: string) => {
						config.scope = value;
					});
			}).setDisabled(disable);
	}

	private showOutiFleName(containerEl: HTMLElement, config: SyncConfig, disable:boolean) {
		const dataFilePathSetting = new Setting(containerEl)
			.setName(i18nHelper.getMessage('121601'))
			.setDesc(i18nHelper.getMessage('121602'))
			.addText((textField) => {
				textField.setPlaceholder(i18nHelper.getMessage('121602'))
					.setValue(config.dataFileNamePath)
					.onChange(async (value) => {
						config.dataFileNamePath = value
					});
			})
			.setDisabled(disable);
	}

	showOutputFolderSelections(containerEl: HTMLElement, config: SyncConfig, disable:boolean) {
		new Setting(containerEl)
			.setName( i18nHelper.getMessage('121501'))
			.setDesc( i18nHelper.getMessage('121502'))
			.addSearch(async (search: SearchComponent) => {
				new PathSuggest(this.app, search.inputEl, 'folder');
				// @ts-ignore
				search.setValue(config.dataFilePath)
					// @ts-ignore
					.setPlaceholder(i18nHelper.getMessage('121503'))
					.onChange(async (value: string) => {
						config.dataFilePath = value;
					});
			})
			.setDisabled(disable);
	}

	showTemplateFileSelectionSetting(containerEl: HTMLElement, config: SyncConfig, disable:boolean) {
		containerEl.empty();
		const key:string = this.getKey(config.syncType);
		// @ts-ignore
		let setting = new Setting(containerEl)
			.setName(i18nHelper.getMessage('121101'))
			.setDesc(i18nHelper.getMessage('121102'))
			.addSearch(async (search: SearchComponent) => {
				new PathSuggest(this.app, search.inputEl, 'file');
				// @ts-ignore
				search.setValue(config.templateFile)
					// @ts-ignore
					.onChange(async (value: string) => {
						config.templateFile = value;
					});
			})
			.setDisabled(disable);

		setting.addExtraButton((button) => {
			button
				.setIcon('copy')
				.setTooltip(i18nHelper.getMessage('121903'))
				.onClick(async () => {
					// @ts-ignore
					navigator.clipboard.writeText(getDefaultTemplateContent(key));
				});
		});
		setting.addExtraButton((button) => {
			button
				.setIcon('document')
				.setTooltip(i18nHelper.getMessage('121901'))
				.onClick(async () => {
					// @ts-ignore
					navigator.clipboard.writeText(getDefaultTemplateContent(key, false))
				});
		});


	}


	private getKey(supportType: string) {
		return supportType + 'TemplateFile';
	}

	showForceUpdateConfig(containerEl: HTMLElement, config: SyncConfig, disable:boolean, onToggle?: () => void) {
		new Setting(containerEl)
			.setName(i18nHelper.getMessage('110031'))
			.setDesc(i18nHelper.getMessage('500110'))
			.addToggle((toggleComponent) => {
				toggleComponent
	
					.setValue(config.force)
					.onChange(async (value) => {
						config.force = value;
						onToggle && onToggle();
					});
			})
			.setDisabled(disable);
	}

	showInheritOldFieldsConfig(containerEl: HTMLElement, config: SyncConfig, disable:boolean, onToggle?: () => void) {
		const setting = new Setting(containerEl)
			.setName(i18nHelper.getMessage('110097'))
			.setDesc(i18nHelper.getMessage('110098'))
			.setDisabled(disable || !config.force);
		setting.addToggle((toggleComponent) => {
			toggleComponent
				.setValue(!!config.inheritOldFields)
				.onChange(async (value) => {
					config.inheritOldFields = value;
					onToggle && onToggle();
				});
		});
	}



	showAttachmentsFileConfig(containerEl: HTMLElement, config: SyncConfig, disable:boolean) {
		const settings = new Setting(containerEl);
		let attachmentFileEl = containerEl.createDiv('attachment-file-path-selection');
		settings.setName(i18nHelper.getMessage('121430'))
			.setDesc(i18nHelper.getMessage('121431'))
			.addToggle((toggleComponent) => {
				toggleComponent
	
					.setValue(config.cacheImage)
					.onChange(async (value) => {
						config.cacheImage = value;
						this.showAttachmentPathSelections(value, attachmentFileEl, config, disable);
					});
			})
			.setDisabled(disable);
		this.showAttachmentPathSelections(config.cacheImage, attachmentFileEl, config, disable);
	}

	showAttachmentPathSelections(show:boolean, containerEl: HTMLElement, config: SyncConfig, disable:boolean) {
		containerEl.empty();
		if (!show) {
			return;
		}
		new Setting(containerEl)
			.setName( i18nHelper.getMessage('121432'))
			.setDesc( i18nHelper.getMessage('121433'))
			.addSearch(async (search: SearchComponent) => {
				new PathSuggest(this.plugin.app, search.inputEl, 'folder');
				// @ts-ignore
				search.setValue(config.attachmentPath)
					// @ts-ignore
					.setPlaceholder(i18nHelper.getMessage('121434'))
					.onChange(async (value: string) => {
						config.attachmentPath = value;
					});
			})
			.setDisabled(disable);
		new Setting(containerEl)
			.setName( i18nHelper.getMessage('121452'))
			.setDesc( i18nHelper.getMessage('121453'))
			.addSearch(async (search: SearchComponent) => {
				new PathSuggest(this.plugin.app, search.inputEl, 'folder');
				// @ts-ignore
				search.setValue(config.attachmentFileName)
					// @ts-ignore
					.setPlaceholder(i18nHelper.getMessage('121454'))
					.onChange(async (value: string) => {
						config.attachmentFileName = value;
					});
			})
			.setDisabled(disable);

		new Setting(containerEl)
			.setName(i18nHelper.getMessage('121435'))
			.setDesc(i18nHelper.getMessage('121438'))
			.addToggle((toggleComponent) => {
				toggleComponent
					.setValue(config.cacheHighQuantityImage)
					.onChange(async (value) => {
						config.cacheHighQuantityImage = value;
					});
			})
			.setDisabled(disable);

			new Setting(containerEl)
				.setName(i18nHelper.getMessage('121470'))
				.setDesc(i18nHelper.getMessage('121471'))
				.addToggle((toggleComponent) => {
					toggleComponent
						.setValue(config.overwriteCoverImage)
						.onChange(async (value) => {
							config.overwriteCoverImage = value;
						});
				})
				.setDisabled(disable);
	}

	showUpdateAllConfig(containerEl: HTMLElement, config: SyncConfig, disable:boolean) {
		new Setting(containerEl)
			.setName(i18nHelper.getMessage('110039'))
			.setDesc(i18nHelper.getMessage('110040'))
			.addToggle((toggleComponent) => {
				toggleComponent
					.setTooltip(i18nHelper.getMessage('110040'))
					.setValue(config.incrementalUpdate)
					.onChange(async (value) => {
						config.incrementalUpdate = value;
					});
			})
			.setDisabled(disable);
	}

	private showCondition(contentEl: HTMLElement, config: SyncConfig, disable: boolean) {
		showConditionItem(contentEl.createDiv("sync-douban-condition"), this.plugin.settingsManager, config, disable);
	}
}

function showConditionItem(containerEl: HTMLElement, manager: SettingsManager, config: SyncConfig, disable: boolean) {
	containerEl.empty();
	const condition = new Setting(containerEl).setName(i18nHelper.getMessage('110070'))

	const conditionDesc = condition.descEl.createDiv('sync-douban-condition-desc');
	new DropdownComponent(conditionDesc).addOptions(SyncConditionTypeRecords)
		.setValue(config.syncConditionType)
		.onChange((value) => {
			config.syncConditionType = value;
			showConditionItem(containerEl, manager, config, disable);
		}).setDisabled(disable);
	showConditionItemInput(conditionDesc, config, disable);
}

function showConditionItemInput(containerEl: HTMLElement, config: SyncConfig, disable: boolean) {
	if (config.syncConditionType == SyncConditionType.CUSTOM_ITEM) {
		showCustomInputCount(containerEl, config, disable);
	}else if (config.syncConditionType == SyncConditionType.CUSTOM_TIME) {
		showCustomInputTime(containerEl, config, disable);
	}
}

function showCustomInputCount(containerEl: HTMLElement, config: SyncConfig, disable: boolean) {
	containerEl.createEl('span', { text: '   ' })
	containerEl.createEl('span', { text: i18nHelper.getMessage('110077') })
	containerEl.createEl('span', { text: i18nHelper.getMessage('110078') })
	const fromField = new TextComponent(containerEl);
	fromField.setPlaceholder(i18nHelper.getMessage('110080'))
		.setValue(config.syncConditionCountFromValue + '')
		.onChange(async (value) => {
			if (!value) {
				config.syncConditionCountFromValue = 1;
				return;
			}
			try {
				config.syncConditionCountFromValue = parseInt(value);
			}catch (e) {
				log.notice(i18nHelper.getMessage('112080'))
			}
		}).setDisabled(disable);
	let fromEl = fromField.inputEl;
	fromEl.addClass('obsidian_douban_settings_input')
	fromEl.style.width ='20%';
	containerEl.appendChild(fromEl);
	const lang = window.localStorage.getItem('language') || 'en';
	if (lang === 'zh' || lang === 'zh-CN' || lang === 'zh-TW') {
		containerEl.createEl('span', {text: i18nHelper.getMessage('110073')})
	}

	containerEl.createEl('span', { text: i18nHelper.getMessage('110079') })
	containerEl.createEl('span', { text: i18nHelper.getMessage('110078') })
	const toField = new TextComponent(containerEl);
	toField.setPlaceholder(i18nHelper.getMessage('110080'))
		.setValue(config.syncConditionCountToValue + '')
		.onChange(async (value) => {
			if (!value) {
				config.syncConditionCountToValue = 30;
				return;
			}
			try {
				config.syncConditionCountToValue = parseInt(value);
			}catch (e) {
				log.notice(i18nHelper.getMessage('112080'))
			}
		}).setDisabled(disable);
	let toEl = toField.inputEl;
	toEl.addClass('obsidian_douban_settings_input')
	toEl.style.width ='20%';
	containerEl.appendChild(toEl);
	if (lang === 'zh' || lang === 'zh-CN' || lang === 'zh-TW') {
		containerEl.createEl('span', {text: i18nHelper.getMessage('110073')})
	}
	containerEl.createEl('span', {text: '  '})
	const buttopn = new ButtonComponent(containerEl).setIcon('help').setTooltip(i18nHelper.getMessage('110095'))
	containerEl.appendChild(buttopn.buttonEl);
}

function showCustomInputTime(containerEl: HTMLElement, config: SyncConfig, disable: boolean) {
	containerEl.createEl('span', { text: i18nHelper.getMessage('110077') })
	const fromDateField = new TextComponent(containerEl);
	const fromDateEl = fromDateField.inputEl;
	fromDateEl.type = 'date';
	fromDateEl.value = config.syncConditionDateFromValue ? config.syncConditionDateFromValue.toISOString().substring(0, 10) : TimeUtil.getLastMonth().toISOString().substring(0, 10);
	fromDateField.setPlaceholder(i18nHelper.getMessage('110075'))
		.setValue(config.syncConditionDateFromValue ? config.syncConditionDateFromValue.toISOString().substring(0, 10) : TimeUtil.getLastMonth().toISOString().substring(0, 10))
		.onChange(async (value) => {
			if (!value) {
				return;
			}
			try {
				config.syncConditionDateFromValue = new Date(value);
			}catch (e) {
				log.notice(i18nHelper.getMessage('110082'))
			}
		}).setDisabled(disable);
	fromDateEl.addClass('obsidian_douban_settings_input')
	containerEl.appendChild(fromDateEl);

	containerEl.createEl('span', { text: i18nHelper.getMessage('110079') })
	const toDateField = new TextComponent(containerEl);
	let toDateEl = toDateField.inputEl;
	toDateEl.type = 'date';
	toDateEl.value = config.syncConditionDateToValue ? config.syncConditionDateToValue.toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10);
	toDateField.setPlaceholder(i18nHelper.getMessage('110075'))
		.setValue(config.syncConditionDateToValue ? config.syncConditionDateToValue.toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10))
		.onChange(async (value) => {
			if (!value) {
				return;
			}
			try {
				config.syncConditionDateToValue = new Date(value);
			}catch (e) {
				log.notice(i18nHelper.getMessage('110082'))
			}
		}).setDisabled(disable);
	toDateEl.addClass('obsidian_douban_settings_input')
	containerEl.appendChild(toDateEl);
	new ButtonComponent(containerEl).setIcon('help').setTooltip(i18nHelper.getMessage('110095'))

}
