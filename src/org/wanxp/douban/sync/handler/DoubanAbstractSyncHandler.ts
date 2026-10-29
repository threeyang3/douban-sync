import DoubanPlugin from "../../../main";
import {
	BasicConst,
	PAGE_SIZE,
	SyncConditionType,
	SyncType,
} from "../../../constant/Constsant";
import {DoubanSyncHandler} from "./DoubanSyncHandler";
import {SyncConfig} from "../model/SyncConfig";
import HandleContext from "../../data/model/HandleContext";
import {SubjectListItem} from "../../data/model/SubjectListItem";
import {sleepRange} from "../../../utils/TimeUtil";
import DoubanSubjectLoadHandler from "../../data/handler/DoubanSubjectLoadHandler";
import {DoubanListHandler} from "./list/DoubanListHandler";
import DoubanSubject from "../../data/model/DoubanSubject";
import {log} from "../../../utils/Logutil";
import {i18nHelper} from "../../../lang/helper";
import {SearchPage} from "../../data/model/SearchPage";
import {SearchPageTypeOf} from "../../data/model/SearchPageTypeOf";
import SyncStatusHolder from "../model/SyncStatusHolder";
import {SyncPreviewEntry, SyncPreviewResult} from "../model/SyncPreviewResult";

function isPreviewMode(context: HandleContext): boolean {
	return !!context.syncPreviewMode;
}

export abstract class DoubanAbstractSyncHandler<T extends DoubanSubject>
	implements DoubanSyncHandler
{
	private plugin: DoubanPlugin;
	private doubanSubjectLoadHandler: DoubanSubjectLoadHandler<T>;
	private doubanListHandlers: DoubanListHandler[];

	constructor(
		plugin: DoubanPlugin,
		doubanSubjectLoadHandler: DoubanSubjectLoadHandler<T>,
		doubanListHandlers: DoubanListHandler[],
	) {
		this.plugin = plugin;
		this.doubanSubjectLoadHandler = doubanSubjectLoadHandler;
		this.doubanListHandlers = doubanListHandlers;
	}

	support(t: string): boolean {
		return this.getSyncType() == t;
	}

	abstract getSyncType(): SyncType;

	async preview(syncConfig: SyncConfig, context: HandleContext): Promise<SyncPreviewResult> {
		const previewContext: HandleContext = {
			...context,
			syncConfig,
			syncPreviewMode: true,
		};
		const items = await this.collectItems(syncConfig, previewContext);
		const previewStatus = new SyncStatusHolder(syncConfig, this.plugin.app);
		previewStatus.initSyncHandledData(this.plugin.settings.syncHandledDataArray);
		await previewStatus.buildExistingFilesCache(syncConfig?.dataFilePath || '');

		const entries: SyncPreviewEntry[] = [];
		let createCount = 0;
		let replaceCount = 0;
		let existsCount = 0;
		let unHandleCount = 0;

		for (const item of items) {
			if (!previewStatus.shouldSync(item.id)) {
				unHandleCount++;
				entries.push({id: item.id, title: item.title, action: 'unHandle'});
				continue;
			}

			const existingFilePath = previewStatus.getExistingFilePath(item.id);
			if (existingFilePath) {
				if (syncConfig.force) {
					replaceCount++;
					entries.push({id: item.id, title: item.title, action: 'replace', existingFilePath});
				} else {
					existsCount++;
					entries.push({id: item.id, title: item.title, action: 'exists', existingFilePath});
				}
			} else {
				createCount++;
				entries.push({id: item.id, title: item.title, action: 'create'});
			}
		}

		const inheritSummary: string[] = [];
		if (syncConfig.force && syncConfig.inheritOldFields) {
			if (this.plugin.settings.dataProtection.preserveCustomProperties) {
				inheritSummary.push('frontmatter 自定义属性');
			}
			if (this.plugin.settings.dataProtection.preserveRecord) {
				inheritSummary.push('## 记录');
			}
			if (this.plugin.settings.dataProtection.preserveThoughts) {
				inheritSummary.push('## 感想');
			}
		}

		return {
			total: items.length,
			createCount,
			replaceCount,
			existsCount,
			unHandleCount,
			affectedCount: createCount + replaceCount,
			inheritSummary,
			backupEnabled: !!this.plugin.settings.syncBackupBeforeReplace,
			entries,
		};
	}

	async sync(syncConfig: SyncConfig, context: HandleContext): Promise<void> {
		if (syncConfig.syncConditionType == SyncConditionType.CUSTOM_TIME) {
			await this.syncByTimeLimit(syncConfig, context);
		} else if (syncConfig.syncConditionType == SyncConditionType.CUSTOM_ITEM) {
			await this.syncByCountLimit(syncConfig, context);
		}else if (syncConfig.syncConditionType == SyncConditionType.ALL) {
			await this.syncAll(syncConfig, context);
		}else if (syncConfig.syncConditionType == SyncConditionType.LAST_THIRTY) {
			await this.syncLastThirty(syncConfig, context);
		}else {
			log.warn(i18nHelper.getMessage("110083"));
		}
	}

	async getByTimeLimit(syncConfig: SyncConfig, context: HandleContext): Promise<SubjectListItem[]> {
		const startDate = syncConfig.syncConditionDateFromValue
			? new Date(syncConfig.syncConditionDateFromValue)
			: null;
		const endDate = syncConfig.syncConditionDateToValue
			? new Date(syncConfig.syncConditionDateToValue)
			: null;
		if (!startDate && !endDate) {
			log.warn(i18nHelper.getMessage("110081"));
			return [];
		}
		// Fixed offsets avoid relying on list date ordering or valid dates on every item.
		const needHandleItems: SubjectListItem[] = [];
		const seen = new Set<string>();
		context.syncOffset = 0;
		while (!this.isStopped(context)) {
			const page = await this.getItems(syncConfig, context);
			if (this.isStopped(context) || !page?.list?.length) break;
			for (const item of page.list) {
				if (!item || seen.has(item.id)) continue;
				seen.add(item.id);
				const date = item.updateDate;
				if (date && Number.isFinite(date.getTime())
					&& (!startDate || date >= startDate) && (!endDate || date <= endDate)) {
					needHandleItems.push(item);
				}
			}
			context.syncOffset += PAGE_SIZE;
			if (context.syncOffset >= page.total) break;
			if (!isPreviewMode(context)) {
				await sleepRange(BasicConst.CALL_DOUBAN_DELAY,
					BasicConst.CALL_DOUBAN_DELAY + BasicConst.CALL_DOUBAN_DELAY_RANGE);
			}
		}
		return needHandleItems;
	}

	async syncByTimeLimit(syncConfig: SyncConfig, context: HandleContext) {
		const items = await this.getByTimeLimit(syncConfig, context);
		if (!items || items.length == 0) {
			return;
		}

		const subjectListItems = await this.removeExists(items, syncConfig, context);

		const searchPage = new SearchPageTypeOf<SubjectListItem>(
			subjectListItems.length,
			1,
			subjectListItems.length,
			null,
			subjectListItems,
		);
		await this.handleItems(searchPage, subjectListItems, context);
	}

	private async collectItems(syncConfig: SyncConfig, context: HandleContext): Promise<SubjectListItem[]> {
		if (syncConfig.syncConditionType == SyncConditionType.CUSTOM_TIME) {
			return await this.getByTimeLimit(syncConfig, context);
		}
		if (syncConfig.syncConditionType == SyncConditionType.CUSTOM_ITEM) {
			return await this.collectByCountLimit(syncConfig, context);
		}
		if (syncConfig.syncConditionType == SyncConditionType.ALL) {
			return await this.collectAll(syncConfig, context);
		}
		if (syncConfig.syncConditionType == SyncConditionType.LAST_THIRTY) {
			return await this.collectLastThirty(syncConfig, context);
		}
		return [];
	}

	private async getItems(
		syncConfig: SyncConfig,
		context: HandleContext,
	): Promise<SearchPageTypeOf<SubjectListItem>> {
		const supportHandlers: DoubanListHandler[] = this.doubanListHandlers.filter((h) => h.support(syncConfig));
		const handler = supportHandlers[0];
		if (this.isStopped(context)) {
			return SearchPage.emptyWithNoType();
		}
		const item = await handler.getPageData(context);
		if (this.isStopped(context)) {
			return SearchPage.emptyWithNoType();
		}
		return item ? new SearchPageTypeOf(item.total, item.pageNum, item.pageSize, item.type,
			item.list?.filter(entry => entry?.id) || []) : SearchPage.emptyWithNoType();
	}

	private async removeExists(
		items: SubjectListItem[],
		syncConfig: SyncConfig,
		context: HandleContext,
	): Promise<SubjectListItem[]> {
		if (this.isStopped(context)) {
			return [];
		}
		return items;
	}

	private async handleItems(
		searchPage: SearchPage,
		items: SubjectListItem[],
		context: HandleContext,
		cacheReady = false,
	): Promise<void> {
		if (!items || items.length == 0) {
			return;
		}
		const {syncStatus} = context.syncStatusHolder;
		const {syncConfig} = context;
		syncStatus.totalNum(searchPage.total);
		const needHandled: number = syncStatus.getTotal() - syncStatus.getHasHandle();
		syncStatus.setNeedHandled(needHandled);

		const dataFilePath = syncConfig?.dataFilePath || '';
		if (!cacheReady) await syncStatus.buildExistingFilesCache(dataFilePath);

		for (const item of items) {
			if (this.isStopped(context)) {
				return;
			}
			try {
				if (syncStatus.shouldSync(item.id)) {
					const localExists = syncStatus.checkLocalExists(item.id);
					if (localExists && !syncConfig.force) {
						syncStatus.exists(item.id, item.title, syncStatus.getExistingFilePath(item.id));
					} else {
						await this.doubanSubjectLoadHandler.handle(item.id, context);
						await sleepRange(
							BasicConst.CALL_DOUBAN_DELAY,
							BasicConst.CALL_DOUBAN_DELAY + BasicConst.CALL_DOUBAN_DELAY_RANGE,
						);
					}
				} else {
					syncStatus.unHandle(item.id, item.title);
				}
			} catch (e) {
				log.error(`Failed to sync item ${item.id}: ${e}`, e);
				log.notice(i18nHelper.getMessage("130120"));
				syncStatus.fail(item.id, item.title);
			}
		}
	}

	private isStopped(context: HandleContext): boolean {
		if (isPreviewMode(context)) {
			return false;
		}
		return !context.plugin.statusHolder.syncing();
	}

	private async syncByCountLimit(syncConfig: SyncConfig, context: HandleContext) {
		const items = await this.collectByCountLimit(syncConfig, context);
		if (!items.length) {
			return;
		}
		const page = new SearchPageTypeOf<SubjectListItem>(
			items.length,
			1,
			items.length,
			null,
			items,
		);
		await this.handleItems(page, items, context);
	}

	private async collectByCountLimit(syncConfig: SyncConfig, context: HandleContext): Promise<SubjectListItem[]> {
		const {syncConditionCountFromValue, syncConditionCountToValue} = syncConfig;
		const startOffset = Math.floor((syncConditionCountFromValue - 1) / PAGE_SIZE) * PAGE_SIZE;
		context.syncOffset = startOffset;
		let endOffsetNumberForCustom = 0;
		let needHandleTotalCustomItem = 0;
		let isFirstStep = true;
		let handleCount = 0;
		const result: SubjectListItem[] = [];
		do {
			const searchPage = await this.getItems(syncConfig, context);
			if (this.isStopped(context)) {
				break;
			}
			const {list, total} = searchPage;
			if (!searchPage || !list || list.length == 0) {
				break;
			}
			if (syncConditionCountFromValue > total) {
				if (!isPreviewMode(context)) {
					context.syncStatusHolder.syncStatus.setMessage(i18nHelper.getMessage("130121", total));
				}
				break;
			}
			if (endOffsetNumberForCustom == 0) {
				endOffsetNumberForCustom = Math.min(syncConditionCountToValue ? syncConditionCountToValue : searchPage.total, searchPage.total);
				needHandleTotalCustomItem = endOffsetNumberForCustom - syncConditionCountFromValue + 1;
			}

			let subjectListItems: SubjectListItem[] = [];
			if (Math.floor((syncConditionCountFromValue - 1) / PAGE_SIZE) == Math.floor((endOffsetNumberForCustom - 1) / PAGE_SIZE)) {
				const startIndex = Math.floor((syncConditionCountFromValue - 1) % PAGE_SIZE);
				const endIndex = Math.floor((endOffsetNumberForCustom - 1) % PAGE_SIZE);
				subjectListItems = await this.removeExists(list.slice(startIndex, endIndex + 1), syncConfig, context);
				handleCount += (endIndex - startIndex + 1);
			} else if (isFirstStep) {
				const startIndex = (syncConditionCountFromValue - 1) % PAGE_SIZE;
				handleCount += (list.length - startIndex);
				subjectListItems = await this.removeExists(list.slice(startIndex), syncConfig, context);
				isFirstStep = false;
			} else if (needHandleTotalCustomItem - handleCount <= PAGE_SIZE) {
				const endIndex = needHandleTotalCustomItem - handleCount;
				subjectListItems = await this.removeExists(list.slice(0, endIndex), syncConfig, context);
				handleCount += endIndex;
			} else {
				subjectListItems = await this.removeExists(list, syncConfig, context);
				handleCount += PAGE_SIZE;
			}

			result.push(...subjectListItems);
			context.syncOffset = context.syncOffset + PAGE_SIZE;
			if (!isPreviewMode(context)) {
				await sleepRange(
					BasicConst.CALL_DOUBAN_DELAY,
					BasicConst.CALL_DOUBAN_DELAY + BasicConst.CALL_DOUBAN_DELAY_RANGE,
				);
			}
		} while (handleCount < needHandleTotalCustomItem);
		return result;
	}

	private async syncAll(syncConfig: SyncConfig, context: HandleContext) {
		await context.syncStatusHolder.syncStatus.buildExistingFilesCache(syncConfig.dataFilePath || '');
		await this.collectAll(syncConfig, context, async page => {
			await this.handleItems(page, page.list, context, true);
		});
	}

	private async collectAll(syncConfig: SyncConfig, context: HandleContext,
		onPage?: (page: SearchPageTypeOf<SubjectListItem>) => Promise<void>): Promise<SubjectListItem[]> {
		context.syncOffset = 0;
		let handleCount = 0;
		let totalForHandle = 0;
		let isFirstStep = true;
		const result: SubjectListItem[] = [];
		do {
			const searchPage = await this.getItems(syncConfig, context);
			if (this.isStopped(context)) {
				break;
			}

			const {list, total} = searchPage;
			if (!searchPage || !list || list.length == 0) {
				break;
			}
			if (isFirstStep) {
				totalForHandle = total;
				isFirstStep = false;
			}
			handleCount += list.length;
			const subjectListItems = await this.removeExists(list, syncConfig, context);
			if (onPage) {
				await onPage(new SearchPageTypeOf(totalForHandle, searchPage.pageNum, PAGE_SIZE, searchPage.type, subjectListItems));
			} else {
				result.push(...subjectListItems);
			}
			context.syncOffset = context.syncOffset + PAGE_SIZE;
			if (!isPreviewMode(context)) {
				await sleepRange(
					BasicConst.CALL_DOUBAN_DELAY,
					BasicConst.CALL_DOUBAN_DELAY + BasicConst.CALL_DOUBAN_DELAY_RANGE,
				);
			}
		} while (context.syncOffset < totalForHandle);
		return result;
	}

	private async syncLastThirty(syncConfig: SyncConfig, context: HandleContext) {
		const items = await this.collectLastThirty(syncConfig, context);
		if (!items.length) {
			return;
		}
		const page = new SearchPageTypeOf<SubjectListItem>(
			items.length,
			1,
			items.length,
			null,
			items,
		);
		await this.handleItems(page, items, context);
	}

	private async collectLastThirty(syncConfig: SyncConfig, context: HandleContext): Promise<SubjectListItem[]> {
		context.syncOffset = 0;
		const searchPage = await this.getItems(syncConfig, context);
		if (this.isStopped(context)) {
			return [];
		}
		const {list} = searchPage;
		if (!searchPage || !list || list.length == 0) {
			return [];
		}
		return await this.removeExists(list, syncConfig, context);
	}
}
