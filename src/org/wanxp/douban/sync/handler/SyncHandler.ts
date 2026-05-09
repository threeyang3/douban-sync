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
import {FileUtil} from "../../../utils/FileUtil";

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

	async sync() {
		if (this.syncConfig && this.syncConfig.syncType && this.syncConfig.scope) {
			if(this.checkSyncConfig()) {
				this.context.syncStatusHolder.syncStatus.setMessage(this.checkSyncConfig());
				return;
			}
			const syncHandler = this.syncHandlers.find(handler => handler.support(this.syncConfig.syncType));
			if (syncHandler) {
				await syncHandler.sync(this.syncConfig, this.context);
			} else {
				await this.defaultSyncHandler.sync(this.syncConfig, this.context);
			}
		}
		await this.showResult();
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
			extendCondition = `${syncConfig.syncConditionDateFromValue.toISOString().substring(0, 10)} - ${syncConfig.syncConditionDateToValue.toISOString().substring(0, 10)}`;
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
		// 同步结束后分析本地文件数量与同步统计的差异
		let analysis = '';
		try {
			const folderPath = this.syncConfig.dataFilePath || '';
			const allMdFiles = this.app.vault.getMarkdownFiles();
			const normalizedFolder = folderPath.replace(/\\/g, '/');
			const actualFileCount = allMdFiles.filter(f => {
				const fp = f.path.replace(/\\/g, '/');
				return normalizedFolder ? fp.startsWith(normalizedFolder + '/') || fp.startsWith(normalizedFolder) : true;
			}).length;
			const createdCount = statusHandleMap.get(SyncItemStatus.create) || 0;
			const replacedCount = statusHandleMap.get(SyncItemStatus.replace) || 0;
			const existsCount = statusHandleMap.get(SyncItemStatus.exists) || 0;
			const failCount = statusHandleMap.get(SyncItemStatus.fail) || 0;
			const diffTypeCount = statusHandleMap.get(SyncItemStatus.failByDiffType) || 0;
			const expectedCreated = createdCount + replacedCount + existsCount;
			if (expectedCreated !== actualFileCount) {
				const diff = expectedCreated - actualFileCount;
				analysis = '\n### 文件数量分析\n\n';
				analysis += `- 预期本地条目文件数: **${expectedCreated}**（创建 ${createdCount} + 替换 ${replacedCount} + 已存在 ${existsCount}）\n`;
				analysis += `- 实际本地文件数: **${actualFileCount}**\n`;
				analysis += `- 差额: **${diff}** 个\n`;
				if (diff === diffTypeCount + failCount) {
					analysis += `\n差额与失败条目数一致（类型不匹配 ${diffTypeCount} + 失败 ${failCount}），原因：\n`;
					if (diffTypeCount > 0) {
						analysis += `- 类型不匹配的 ${diffTypeCount} 个条目已被跳过（详见上方明细中标记为 [类型不匹配] 的条目）\n`;
					}
					if (failCount > 0) {
						analysis += `- ${failCount} 个条目同步失败（详见上方明细中标记为 [已失败] 的条目）\n`;
					}
				} else {
					analysis += `\n差额与失败统计不完全匹配，可能原因：\n`;
					analysis += `- 部分条目生成的文件名可能与现有文件冲突或被覆盖\n`;
					analysis += `- 手动删除或移动过部分条目文件\n`;
				}
			}
		} catch (_) { /* ignore count errors */ }
		const result = i18nHelper.getMessage('110037', condition, summary, details + analysis);
		const resultFileName = `${i18nHelper.getMessage('110038')}_${moment(new Date()).format('YYYYMMDDHHmmss')}`
		await this.plugin.fileHandler.createNewNoteWithData(`${this.syncConfig.dataFilePath}/${resultFileName}`, result, true);
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
