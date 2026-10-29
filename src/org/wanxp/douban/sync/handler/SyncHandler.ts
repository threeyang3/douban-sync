import HandleContext from "../../data/model/HandleContext";
import {SyncConfig} from "../model/SyncConfig";
import DoubanPlugin from "../../../main";
import {App, moment} from "obsidian";
import {DoubanSyncHandler} from "./DoubanSyncHandler";
import {DoubanOtherSyncHandler} from "./DoubanOtherSyncHandler";
import { DoubanMovieSyncHandler } from "./DoubanMovieSyncHandler";
import { DoubanMusicSyncHandler } from "./DoubanMusicSyncHandler";
import { DoubanBookSyncHandler } from "./DoubanBookSyncHandler";
import {i18nHelper} from "../../../lang/helper";
import {DoubanTeleplaySyncHandler} from "./DoubanTeleplaySyncHandler";
import {SyncConditionType, SyncItemStatus} from "../../../constant/Constsant";
import {DoubanGameSyncHandler} from "./DoubanGameSyncHandler";
import {scanVaultForDoubanIds} from "../../../utils/VaultUtil";
import {FileUtil} from "../../../utils/FileUtil";
import {SyncOutcome} from "../model/SyncStatusHolder";

export default class SyncHandler {
	private app: App;
	private plugin: DoubanPlugin;
	private syncConfig: SyncConfig;
	private context: HandleContext;
	private syncHandlers: DoubanSyncHandler[];
	private defaultSyncHandler: DoubanSyncHandler;


	constructor(app: App, plugin: DoubanPlugin, syncConfig: SyncConfig, context: HandleContext) {
		this.app = app;
		this.plugin = plugin;
		this.syncConfig = syncConfig;
		this.context = context;
		this.defaultSyncHandler = new DoubanOtherSyncHandler(plugin);
		this.syncHandlers = [
			new DoubanMovieSyncHandler(plugin),
			new DoubanBookSyncHandler(plugin),
			// new DoubanBroadcastSyncHandler(plugin),
			// new DoubanNoteSyncHandler(plugin),
			new DoubanMusicSyncHandler(plugin),
			new DoubanTeleplaySyncHandler(plugin),
			new DoubanGameSyncHandler(plugin),
			this.defaultSyncHandler
		];
	}

	async sync(): Promise<SyncOutcome> {
		const status = this.context.syncStatusHolder.syncStatus;
		try {
			if (this.syncConfig && this.syncConfig.syncType && this.syncConfig.scope) {
				if(this.checkSyncConfig()) {
					throw new Error(this.checkSyncConfig());
				}
				const syncHandler = this.syncHandlers.find(handler => handler.support(this.syncConfig.syncType));
				if (syncHandler) {
					await syncHandler.sync(this.syncConfig, this.context);
				} else {
					await this.defaultSyncHandler.sync(this.syncConfig, this.context);
				}
			} else {
				throw new Error('Missing sync type or scope');
			}
		} catch (error) {
			status.recordError(error);
		}
		const outcome = status.finish(!this.plugin.statusHolder.syncing());
		try {
			await this.showResult();
		} catch (error) {
			status.reportErrors.push(String(error));
		}
		return outcome;
	}

	async showResult() {
		const {syncStatusHolder} = this.context;
		const {syncStatus} = syncStatusHolder;
		const {statusHandleMap} = syncStatus;
		const {syncResultMap} = syncStatus;
		const {syncConfig} = this;

		let extendCondition = '';
		if (syncConfig.syncConditionType == SyncConditionType.CUSTOM_ITEM) {
			extendCondition = `${syncConfig.syncConditionCountFromValue} - ${syncConfig.syncConditionCountToValue}`;
		} else if (syncConfig.syncConditionType == SyncConditionType.CUSTOM_TIME) {
			extendCondition = `${syncConfig.syncConditionDateFromValue?.toISOString().substring(0, 10) || '*'} - ${syncConfig.syncConditionDateToValue?.toISOString().substring(0, 10) || '*'}`;
		}


		const condition = `
1. ${i18nHelper.getMessage('110030')} \`${syncStatus.getTypeName()}\`
2. ${i18nHelper.getMessage('110032')} \`${syncStatus.getScopeName()}\`
3. ${i18nHelper.getMessage('110070')} \`${syncStatus.getSyncConditionName()}\`${extendCondition? (' => ' + extendCondition) : ''}
4. ${i18nHelper.getMessage('110039')} \`${syncConfig.incrementalUpdate?i18nHelper.getMessage('110055'):i18nHelper.getMessage('110056')}\`
5. ${i18nHelper.getMessage('110031')} \`${syncConfig.force?i18nHelper.getMessage('110055'):i18nHelper.getMessage('110056')}\`
`


		let summary
			= `${i18nHelper.getMessage('110053', i18nHelper.getMessage('110050'), i18nHelper.getMessage('110051'), i18nHelper.getMessage('110052'))}
|-----|----|----------------------------------|
`;
		summary += `${i18nHelper.getMessage('110053', i18nHelper.getMessage('syncall'), syncStatus.getTotal(), i18nHelper.getMessage('syncall_desc'))}
`;
		for (const [key, value] of statusHandleMap) {
			// @ts-ignore
			summary+= `${i18nHelper.getMessage('110053', i18nHelper.getMessage(key), value, i18nHelper.getMessage(key + '_desc'))}
`;
		}
		summary += `${i18nHelper.getMessage('110053', i18nHelper.getMessage('notsync'), syncStatus.getTotal()-syncStatus.getHasHandle(), i18nHelper.getMessage('notsync_desc'))}
`;
		let details = '';
		for (const [, value] of syncResultMap) {
			if (value.status == 'unHandle') {
				// @ts-ignore
				details+= `${value.id}-  ${value.title}  :  ${i18nHelper.getMessage(value.status)}`;
				if (value.detailMsg) {
					details+= ` (${value.detailMsg})`;
				}
				details+= '\n';
			}else {
				// 使用保存的实际文件名生成链接
				// fileName 可能是完整路径，需要提取文件名（不含扩展名）
				let linkName = value.fileName;
				if (linkName) {
					// 从路径中提取文件名（最后一个 / 或 \ 之后的部分）
					const lastSlash = Math.max(linkName.lastIndexOf('/'), linkName.lastIndexOf('\\'));
					if (lastSlash >= 0) {
						linkName = linkName.substring(lastSlash + 1);
					}
					// 移除 .md 扩展名
					if (linkName.endsWith('.md')) {
						linkName = linkName.substring(0, linkName.length - 3);
					}
				} else {
					// 回退到使用 title
					linkName = FileUtil.replaceSpecialCharactersForFileName(value.title);
				}
				// @ts-ignore
				details+= `${value.id}-[[${linkName}]]:  ${i18nHelper.getMessage(value.status)}`;
				if (value.detailMsg) {
					details+= ` (${value.detailMsg})`;
				}
				details+= '\n';
			}

		}
		const reportTime = moment(new Date()).format('YYYYMMDDHHmmss');
		const reportPath = `${this.plugin.fileHandler.getTmpPath()}/sync-report-${reportTime}.json`;
		try {
			await this.plugin.fileHandler.writeTextFile(reportPath, JSON.stringify({
				generatedAt: new Date().toISOString(),
				outcome: syncStatus.outcome,
				errors: syncStatus.errors,
				condition: {
					type: syncStatus.getTypeName(),
					scope: syncStatus.getScopeName(),
					syncCondition: syncStatus.getSyncConditionName(),
					incrementalUpdate: syncConfig.incrementalUpdate,
					force: syncConfig.force,
				},
				summary: Object.fromEntries(statusHandleMap.entries()),
				results: Array.from(syncResultMap.values()),
			}, null, 2));
		} catch (error) {
			syncStatus.reportErrors.push(`JSON: ${String(error)}`);
		}
		// 同步结束后分析本地文件数量与同步统计的差异
		let analysis = '';
		try {
			const entries = scanVaultForDoubanIds(this.app, this.syncConfig.dataFilePath || '');
			const expected = Array.from(syncResultMap.values()).filter(item =>
				[SyncItemStatus.create, SyncItemStatus.replace, SyncItemStatus.exists].includes(item.status));
			const paths = new Set(this.app.vault.getMarkdownFiles().map(file => file.path));
			// Fresh writes may not yet be visible in Obsidian's metadata cache.
			const missing = expected.filter(item => item.fileName
				? !paths.has(item.fileName) : !entries.has(item.id));
			if (missing.length) {
				analysis = '\n### 文件数量分析\n\n';
				analysis += '- 本次预期条目文件数: **' + expected.length + '**\n';
				analysis += '- 本次核验存在条目数: **' + (expected.length - missing.length) + '**\n';
				analysis += '- 未找到文件的豆瓣 ID: ' + missing.map(item => item.id).join(', ') + '\n';
			}
		} catch (_) { /* ignore count errors */ }
		const outcomeSummary = i18nHelper.getMessage(`sync_outcome_${syncStatus.outcome}`);
		const errors = syncStatus.errors.map(error => `- ${error.replace(/[\r\n]+/g, ' ')}`).join('\n');
		const reportInfo = syncStatus.reportErrors.length
			? i18nHelper.getMessage('sync_report_failed', syncStatus.reportErrors.join('; '))
			: `JSON: \`${reportPath}\``;
		const result = `${outcomeSummary}\n\n${errors}\n\n` + i18nHelper.getMessage('110037', condition, summary, `${details + analysis}\n\n### 调试报告\n\n- ${reportInfo}\n`);
		const resultFileName = `${i18nHelper.getMessage('110038')}_${moment(new Date()).format('YYYYMMDDHHmmss')}`
		try {
			const created = await this.plugin.fileHandler.createNewNoteWithData(`${this.syncConfig.dataFilePath}/${resultFileName}`, result, true);
			if (!created) throw new Error('Report file already exists');
		} catch (error) {
			syncStatus.reportErrors.push(`Markdown: ${String(error)}`);
		}
	}

	private checkSyncConfig() {
		const {syncConfig} = this;
		switch (syncConfig.syncConditionType) {
			case SyncConditionType.CUSTOM_ITEM:
				if (syncConfig.syncConditionCountFromValue && syncConfig.syncConditionCountToValue) {
					if (syncConfig.syncConditionCountFromValue > syncConfig.syncConditionCountToValue) {
						return i18nHelper.getMessage('110044');
					}
				}
				break;
			case SyncConditionType.CUSTOM_TIME:
				if (syncConfig.syncConditionDateToValue && syncConfig.syncConditionDateFromValue) {
					if (syncConfig.syncConditionDateFromValue > syncConfig.syncConditionDateToValue) {
						return i18nHelper.getMessage('110045');
					}
				}

		}
	}
}
