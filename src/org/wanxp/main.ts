import {
	Action,
	BasicConst,
	SEARCH_ITEM_PAGE_SIZE,
	SearchHandleMode,
	SubjectHandledStatus,
	SupportType,
	SyncTypeRecords
} from "./constant/Constsant";
import {Editor, Notice, Plugin} from "obsidian";

import {DEFAULT_SETTINGS} from "./constant/DefaultSettings";
import {DoubanFuzzySuggester} from "./douban/data/search/DoubanSearchFuzzySuggestModal";
import {DoubanPluginSetting} from "./douban/setting/model/DoubanPluginSetting";
import {DoubanSearchChooseItemHandler} from "./douban/data/handler/DoubanSearchChooseItemHandler";
import {DoubanSearchModal} from "./douban/data/search/DoubanSearchModal";
import {DoubanSettingTab} from "./douban/setting/DoubanSettingTab";
import DoubanSubject from "./douban/data/model/DoubanSubject";
import {DoubanSyncModal} from "./douban/component/DoubanSyncModal";
import FileHandler from "./file/FileHandler";
import {FileUtil} from "./utils/FileUtil";
import GlobalStatusHolder from "./douban/model/GlobalStatusHolder";
import HandleContext from "./douban/data/model/HandleContext";
import HandleResult from "./douban/data/model/HandleResult";
import NetFileHandler from "./net/NetFileHandler";
import SettingsManager from "./douban/setting/SettingsManager";
import {SyncConfig} from "./douban/sync/model/SyncConfig";
import SyncHandler from "./douban/sync/handler/SyncHandler";
import UserComponent from "./douban/user/UserComponent";
import {i18nHelper} from './lang/helper';
import {log} from "src/org/wanxp/utils/Logutil";
import GithubUtil from "./utils/GithubUtil";
import {DoubanPluginOnlineData} from "./douban/setting/model/DoubanPluginOnlineData";
import SearcherV2 from "./douban/data/search/SearchV2";
import {SearchPage} from "./douban/data/model/SearchPage";
import {DoubanNoteManager} from "./douban/note/DoubanNoteManager";
import {UserDataExtractor} from "./douban/userdata/UserDataExtractor";
import {UserDataMerger} from "./douban/userdata/UserDataMerger";
import {UserDataExportModal, UserDataImportModal} from "./douban/userdata/UserDataModal";
import {TFile} from "obsidian";

export default class DoubanPlugin extends Plugin {
	public settings: DoubanPluginSetting;
	public doubanExtractHandler: DoubanSearchChooseItemHandler;
	public doubanStatusBar: HTMLElement;
	public fileHandler: FileHandler;
	public userComponent: UserComponent;
	public settingsManager: SettingsManager;
	public netFileHandler: NetFileHandler;
	public statusHolder: GlobalStatusHolder;
	public onlineData: DoubanPluginOnlineData;
	public settingTab: DoubanSettingTab;
	public doubanNoteManager: DoubanNoteManager;


	async putToObsidian(context: HandleContext, extract: DoubanSubject) {
		const syncStatus = context.syncStatusHolder && context.syncStatusHolder.syncStatus ? context.syncStatusHolder.syncStatus : null;
		try {

			if (!extract) {
				log.warn(i18nHelper.getMessage('140101'));
				return;
			}
			if (context.syncActive && extract.guessType && extract.guessType != extract.type) {
				extract.handledStatus = SubjectHandledStatus.syncTypeDiffAbort;
				if (Action.Sync == context.action) {
					this.showStatus(i18nHelper.getMessage('140207', syncStatus.getHasHandle(), syncStatus.getTotal(), extract.title));
					syncStatus.failByDiffType(extract.id, extract.title,
						`${i18nHelper.getMessage(extract.guessType)} -> ${extract.type}`);
				}else {
					console.log(i18nHelper.getMessage('140102', extract.type, extract.title, extract.guessType));
				}
				return;
			}
			if (Action.Sync == context.action) {
				this.showStatus(i18nHelper.getMessage('140207', syncStatus.getHasHandle(), syncStatus.getTotal(), extract.title));
			}else {
				this.showStatus(i18nHelper.getMessage('140204', extract.title));
			}
			const result  = await this.doubanExtractHandler.parseText(extract, context)
			if (result) {
				await this.putContentToObsidian(context, result);
				extract.handledStatus = SubjectHandledStatus.saved;
			}
			if (Action.Sync == context.action) {
				this.showStatus(i18nHelper.getMessage('140208', syncStatus.getHasHandle(),  syncStatus.getTotal(), extract.title));
			}else {
				this.showStatus(i18nHelper.getMessage('140205', extract.title));
			}
		} catch (e) {
			log.error(i18nHelper.getMessage('140206', e.message), e);
			syncStatus!=null?syncStatus.fail(extract.id, extract.title):null;
		} finally {
			this.clearStatusBarDelay();
		}
	}

	async putContentToObsidian(context: HandleContext, result: HandleResult) {
		const {mode} = context;
		switch (mode) {
			case SearchHandleMode.FOR_CREATE:
				await this.createFile(context, result);
				break;
			case SearchHandleMode.FOR_REPLACE:
				await this.putToEditor(context.editor, result.content);
				break;
		}
	}

	async putToEditor(editor: Editor, content: string) {
		editor.replaceSelection(content);
	}

	async createFile(context: HandleContext, result: HandleResult) {
		let filePath = result.filePath?result.filePath:DEFAULT_SETTINGS.dataFilePath;
		filePath = FileUtil.join(filePath, result.fileName);
		const syncStatus = context.syncStatusHolder && context.syncStatusHolder.syncStatus ? context.syncStatusHolder.syncStatus : null;
		const {subject} = result;
		const {content} = result;
		// 构建完整文件路径（用于更新缓存）
		const fullFilePath = filePath + '.md';
		if (Action.Sync == context.action) {
			if (context.syncStatusHolder.syncStatus.syncConfig.force) {
				// 在force模式下，先检查是否存在该doubanId的旧文件
				const existingFilePath = syncStatus.getExistingFilePath(subject.id);
				// 在替换前提取旧文件的用户数据（自定义属性+正文分区）
				let localUserData = null;
				if (existingFilePath) {
					const existingFile = this.app.vault.getAbstractFileByPath(existingFilePath);
					if (existingFile instanceof TFile) {
						const extractor = new UserDataExtractor(this.app);
						localUserData = await extractor.extractFromFileAsync(existingFile);
					}
				}
				const exists:boolean = await this.fileHandler.createOrReplaceNewNoteWithData(filePath, content, context.showAfterCreate);
				// 数据保护：将旧文件的自定义属性和正文分区合并到新文件
				if (localUserData) {
					const newFile = this.app.vault.getAbstractFileByPath(fullFilePath);
					if (newFile instanceof TFile) {
						const merger = new UserDataMerger();
						const currentContent = await this.app.vault.read(newFile);
						const mergedContent = merger.mergeUserData(
							currentContent, localUserData, this.settings.dataProtection,
						);
						if (mergedContent !== currentContent) {
							await this.app.vault.process(newFile, () => mergedContent);
						}
					}
				}
				if (existingFilePath && existingFilePath !== fullFilePath) {
					// 仅在新文件成功写入并完成继承后删除旧文件
					await this.fileHandler.deleteFile(existingFilePath);
					// 从缓存中移除旧记录
					syncStatus.removeFromExistingCache(subject.id);
				}
				if (exists) {
					syncStatus != null ? syncStatus.replace(subject.id, subject.title, fullFilePath):null;
				}else {
					syncStatus != null ?syncStatus.create(subject.id, subject.title, fullFilePath):null;
				}
			}else {
				const created:boolean = await this.fileHandler.createNewNoteWithData(filePath, content, context.showAfterCreate, false);
				created ?syncStatus.create(subject.id, subject.title, fullFilePath):syncStatus.exists(subject.id, subject.title, fullFilePath);
			}
		}else {
			await this.fileHandler.createNewNoteWithData(filePath, content, context.showAfterCreate);
		}
	}

	async search(searchTerm: string, searchType: SupportType, context: HandleContext) {
		try {
			this.showStatus(i18nHelper.getMessage('140201', searchTerm));
			const result:SearchPage = await SearcherV2.search(searchTerm, searchType, 1, SEARCH_ITEM_PAGE_SIZE, this.settings, context.plugin.settingsManager);
			this.showStatus(i18nHelper.getMessage('140202', result.list.toString()));
			context.searchPage = result;
			new DoubanFuzzySuggester(this, context, searchTerm).showSearchPage(result);
		} catch (e) {
			log.error(i18nHelper.getMessage('140206').replace('{0}', e.message), e);
		} finally {
			this.clearStatusBarDelay();
		}
	}

	async getDoubanTextForActiveFile(context: HandleContext) {
		const activeFile = await this.app.workspace.getActiveFile();
		if (activeFile) {
			const searchTerm = activeFile.basename;
			if (searchTerm) {
				await this.search(searchTerm, SupportType.all, context);
			}
		}
	}

	async getDoubanTextForCreateNewNote(context: HandleContext) {
		new DoubanSearchModal(this.app, this, context, null).open();
	}

	async getDoubanTextForCreateNewNoteForType(context: HandleContext, type: SupportType) {
		new DoubanSearchModal(this.app, this, context, type).open();
	}

	async getDoubanTextForSearchTerm(context: HandleContext) {
		new DoubanSearchModal(this.app, this, context, null).open();
	}

	async showSyncModal(context: HandleContext) {
		new DoubanSyncModal(this.app, this, context).open();
	}

	async onload() {
		console.log("----douban-plugins-load------")
		await this.loadSettings();
		if (this.settings.statusBar) {
			this.doubanStatusBar = this.addStatusBarItem();
		}

		
		this.addCommand({
			id: "searcher-douban-import-and-create-file",
			name: i18nHelper.getMessage("110101"),
			callback: () =>
				this.getDoubanTextForCreateNewNoteForType({plugin: this,
					mode: SearchHandleMode.FOR_CREATE,
					settings: this.settings,
					userComponent: this.userComponent,
				netFileHandler: this.netFileHandler,
				showAfterCreate:true,
				action: Action.SearchAndCrate}, this.settings.searchDefaultType),
		});

		this.addCommand({
			id: "searcher-douban-and-input-current-file",
			name: i18nHelper.getMessage("110002"),
			editorCallback: (editor: Editor) =>
				this.getDoubanTextForSearchTerm({plugin: this,
					mode: SearchHandleMode.FOR_REPLACE,
					settings: this.settings,
					editor: editor,
					userComponent: this.userComponent,
					netFileHandler: this.netFileHandler,
				action: Action.SearchAndReplace}),
		});

		this.addCommand({
			id: "searcher-douban-by-current-file-name",
			name: i18nHelper.getMessage("110001"),
			editorCallback: (editor: Editor) =>
				this.getDoubanTextForActiveFile({plugin: this,
					mode: SearchHandleMode.FOR_REPLACE,
					settings: this.settings,
					editor: editor,
					userComponent: this.userComponent,
					netFileHandler: this.netFileHandler,
				action: Action.SearchEditorAndReplace}),
		});

		this.addCommand({
			id: "sync-douban-import-and-create-file",
			name: i18nHelper.getMessage("110103"),
			callback: () =>
				this.showSyncModal({plugin: this,
					mode: SearchHandleMode.FOR_CREATE,
					settings: this.settings,
					userComponent: this.userComponent,
					netFileHandler: this.netFileHandler,
				action: Action.Sync,
				syncStatusHolder: this.statusHolder}),
		});

		this.addCommand({
			id: "searcher-douban-import-and-create-file-movie-tv",
			name: i18nHelper.getMessage("110102"),
			callback: () =>
				this.getDoubanTextForCreateNewNoteForType({plugin: this,
					mode: SearchHandleMode.FOR_CREATE,
					settings: this.settings,
					userComponent: this.userComponent,
					netFileHandler: this.netFileHandler,
					showAfterCreate:true,
					action: Action.SearchAndCrate}, SupportType.movie),
		});

		this.addCommand({
			id: "searcher-douban-import-and-create-file-book",
			name: i18nHelper.getMessage("110104"),
			callback: () =>
				this.getDoubanTextForCreateNewNoteForType({plugin: this,
					mode: SearchHandleMode.FOR_CREATE,
					settings: this.settings,
					userComponent: this.userComponent,
					netFileHandler: this.netFileHandler,
					showAfterCreate:true,
					action: Action.SearchAndCrate}, SupportType.book),
		});

		this.addCommand({
			id: "searcher-douban-import-and-create-file-music",
			name: i18nHelper.getMessage("110105"),
			callback: () =>
				this.getDoubanTextForCreateNewNoteForType({plugin: this,
					mode: SearchHandleMode.FOR_CREATE,
					settings: this.settings,
					userComponent: this.userComponent,
					netFileHandler: this.netFileHandler,
					showAfterCreate:true,
					action: Action.SearchAndCrate}, SupportType.music),
		});

		this.addCommand({
			id: "searcher-douban-import-and-create-file-game",
			name: i18nHelper.getMessage("110106"),
			callback: () =>
				this.getDoubanTextForCreateNewNoteForType({plugin: this,
					mode: SearchHandleMode.FOR_CREATE,
					settings: this.settings,
					userComponent: this.userComponent,
					netFileHandler: this.netFileHandler,
					showAfterCreate:true,
					action: Action.SearchAndCrate}, SupportType.game),
		});

		this.addCommand({
			id: "douban-create-or-append-note",
			name: i18nHelper.getMessage("110107"),
			callback: () => this.doubanNoteManager?.createOrAppendForCurrentFile(),
		});

		this.addCommand({
			id: "douban-link-existing-note",
			name: i18nHelper.getMessage("110108"),
			callback: () => this.doubanNoteManager?.linkExistingNoteForCurrentFile(),
		});

		this.addCommand({
			id: "douban-export-user-data",
			name: i18nHelper.getMessage("110109"),
			callback: () => new UserDataExportModal(this).open(),
		});

		this.addCommand({
			id: "douban-import-user-data",
			name: i18nHelper.getMessage("110110"),
			callback: () => new UserDataImportModal(this).open(),
		});

		this.settingsManager = new SettingsManager(this.app, this);
		this.userComponent = new UserComponent(this.settingsManager);
		this.netFileHandler = new NetFileHandler(this.fileHandler);
		this.userComponent.assumeLoggedIn();

		this.settingTab = new DoubanSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);

		this.addRibbonIcon('book-open', i18nHelper.getMessage('110103'), () => {
			this.showSyncModal({
				plugin: this,
				mode: SearchHandleMode.FOR_CREATE,
				settings: this.settings,
				userComponent: this.userComponent,
				netFileHandler: this.netFileHandler,
				action: Action.Sync,
				syncStatusHolder: this.statusHolder,
			});
		});

		this.statusHolder = new GlobalStatusHolder(this.app, this);
		this.doubanNoteManager = new DoubanNoteManager(this.app, this);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.migrateTemplateSettings();
		this.doubanExtractHandler = new DoubanSearchChooseItemHandler(this.app, this);
		this.fileHandler = new FileHandler(this.app);
	}

	private migrateTemplateSettings() {
		const templateKeys = [
			{ configKey: 'movieTemplateConfig' as const, fileKey: 'movieTemplateFile' as const },
			{ configKey: 'bookTemplateConfig' as const, fileKey: 'bookTemplateFile' as const },
			{ configKey: 'musicTemplateConfig' as const, fileKey: 'musicTemplateFile' as const },
			{ configKey: 'noteTemplateConfig' as const, fileKey: 'noteTemplateFile' as const },
			{ configKey: 'gameTemplateConfig' as const, fileKey: 'gameTemplateFile' as const },
			{ configKey: 'teleplayTemplateConfig' as const, fileKey: 'teleplayTemplateFile' as const },
		];
		for (const { configKey, fileKey } of templateKeys) {
			const existing = this.settings[configKey];
			// Already a valid TemplateConfig object — skip
			if (existing && typeof existing === 'object' && 'source' in existing) continue;
			// Auto-repair: corrupted config stored as plain string (file path)
			if (existing && typeof existing === 'string') {
				this.settings[configKey] = { source: 'file', filePath: existing };
				continue;
			}
			// Migrate from legacy templateFile string field
			const filePath = this.settings[fileKey];
			if (filePath && typeof filePath === 'string' && filePath.trim()) {
				this.settings[configKey] = { source: 'file', filePath: filePath.trim() };
			} else {
				this.settings[configKey] = { source: 'builtin' };
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}


	async onunload() {
		if (this.statusHolder.syncStatus) {
			await this.statusHolder.onunload();
		}
	}





	showStatus(origin: string) {
		if (!this.settings.statusBar || !this.doubanStatusBar) {
			return;
		}
		this.doubanStatusBar.empty();
		this.doubanStatusBar.setText(origin);
	}

	clearStatusBarDelay() {
		if (!this.settings.statusBar || !this.doubanStatusBar) {
			return;
		}
		setTimeout(() => this.doubanStatusBar.empty(), BasicConst.CLEAN_STATUS_BAR_DELAY)
	}

	async sync(context: HandleContext) {
		const {syncConfig}  = context;
			try {
			const result:boolean = await this.checkLogin(context);
			if (!result) {
				return;
			}
			// @ts-ignore
			new Notice(i18nHelper.getMessage('140301', SyncTypeRecords[syncConfig.syncType]));
			this.initSyncDefaultSettings(syncConfig);
			context.syncStatusHolder.initHandledData();
			// @ts-ignore
			this.showStatus(i18nHelper.getMessage('140203', SyncTypeRecords[syncConfig.syncType]));
			const syncHandler = new SyncHandler(this.app, this, syncConfig, context);
			await syncHandler.sync();
			new Notice(i18nHelper.getMessage('140302'));
		} catch (e) {
			log.error(i18nHelper.getMessage('140206', e.message), e);
		} finally {
			await context.plugin.statusHolder.completeSync();
			this.clearStatusBarDelay();
			context.syncActive = false;
			}
	}

	async checkLogin(context: HandleContext):Promise<boolean> {
		this.settingsManager.debug('主界面:同步时的登录状态检测');
		const uc = context.userComponent;
		// If assumed-logged-in but not verified, verify now (sync needs real user ID)
		if (uc.isLogin() && !uc.isVerified()) {
			await uc.login();
		}
		// If has saved credentials but not logged in, try login
		if (uc.needLogin()) {
			await uc.login();
		}
		if (!uc.isLogin()) {
			this.settingsManager.debug('主界面:同步时的登录状态检测完成: 尝试获取用户信息失败');
			new Notice(i18nHelper.getMessage('140303'));
			return false;
		}
		return true;
	}


	private initSyncDefaultSettings(syncConfig: SyncConfig) {
		syncConfig.dataFilePath = syncConfig.dataFilePath ? syncConfig.dataFilePath : DEFAULT_SETTINGS.dataFilePath;
		syncConfig.templateFile = syncConfig.templateFile ? syncConfig.templateFile : '';
		syncConfig.attachmentPath = syncConfig.attachmentPath ? syncConfig.attachmentPath : DEFAULT_SETTINGS.attachmentPath;
		syncConfig.dataFileNamePath = syncConfig.dataFileNamePath ? syncConfig.dataFileNamePath : DEFAULT_SETTINGS.dataFileNamePath;
		syncConfig.inheritOldFields = !!syncConfig.inheritOldFields;
	}

}

