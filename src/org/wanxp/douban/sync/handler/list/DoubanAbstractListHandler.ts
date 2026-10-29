import { i18nHelper } from "src/org/wanxp/lang/helper";
import { log } from "src/org/wanxp/utils/Logutil";
import { CheerioAPI, load } from "cheerio";
import HandleContext from "../../../data/model/HandleContext";
import { doubanSubjectSyncListUrl } from "../../../../constant/Douban";
import {
	PAGE_SIZE,
	SyncType,
	SyncTypeUrlDomain,
} from "../../../../constant/Constsant";
import { SubjectListItem } from "../../../data/model/SubjectListItem";
import { DoubanListHandler } from "./DoubanListHandler";
import { SyncConfig } from "../../model/SyncConfig";
import { ALL } from "../../../../constant/DoubanUserState";
import { DoubanHttpUtil } from "../../../../utils/DoubanHttpUtil";
import { SearchPage } from "../../../data/model/SearchPage";
import {SearchPageTypeOf} from "../../../data/model/SearchPageTypeOf";
import DoubanPageGuard from "../../../../utils/DoubanPageGuard";

export default abstract class DoubanAbstractListHandler
	implements DoubanListHandler
{
	async getPageData(context: HandleContext): Promise<SearchPage> {
		let all: SubjectListItem[] = [];
		let pages: SearchPage = SearchPage.emptyWithNoType();

		const url: string = this.getUrl(context, context.syncOffset);
		if (!context.syncPreviewMode && !context.plugin.statusHolder.syncing()) {
			return SearchPage.emptyWithNoType();
		}
		let subjectListItemSearchPageTypeOf = await this.getPageList(url, context);
		return subjectListItemSearchPageTypeOf;
	}

	async delay(ms: number) {}

	protected getUrl(context: HandleContext, start: number) {
		return doubanSubjectSyncListUrl(
			this.getSyncTypeDomain(),
			context.userComponent.getUserId(),
			this.getDoType(),
			start,
		);
	}

	abstract getDoType(): string;

	abstract getSyncType(): SyncType;

	getSyncTypeDomain(): string {
		return SyncTypeUrlDomain.get(this.getSyncType());
	}

	async getPageList(
		url: string,
		context: HandleContext,
	): Promise<SearchPageTypeOf<SubjectListItem>> {
		try {
			const html = await DoubanHttpUtil.httpRequestGet(
				url,
				context.plugin.settingsManager.getHeaders(),
				context.plugin.settingsManager,
			);
			DoubanPageGuard.assertCanParse(html);
			return this.parseSubjectFromHtml(load(html), context);
		} catch (e) {
			const detail = DoubanPageGuard.describeError(e);
			context.plugin.statusHolder?.syncStatus?.setMessage(detail);
			log.error(
				i18nHelper
					.getMessage("130101")
					.replace("{0}", detail),
				e,
			);
			throw e;
		}
	}

	parseSubjectFromHtml(
		dataHtml: CheerioAPI,
		context: HandleContext,
	): SearchPageTypeOf<SubjectListItem> {
		const rawItems = dataHtml(".item-show");
		if (!rawItems.length && !dataHtml('.subject-num').length) {
			throw new Error('Unrecognized Douban list structure');
		}
		const items = rawItems
			.get()
			.map((i: any, index: number) => {
				const item = dataHtml(i);
				const linkValue: string = item
					.find("div.title > a")
					.attr("href");
				const titleValue: string = item
					.find("div.title > a")
					.text()
					.trim();
				const updateDateStr: string = item.find("div.date").text().trim();
				let updateDate = null;
				try {
					updateDate = new Date(updateDateStr);
				}catch (e) {
					console.error(e);
					log.info("parse date error:" + titleValue);
				}
				const idPattern = /\/(?:subject|game|note)\/(\d{5,10})(?:\/|$)/;
				let ececResult = idPattern.exec(linkValue);
				if (!ececResult) {
					log.info(`Skipping invalid list entry at offset ${context.syncOffset}, index ${index}`);
					return null;
				}
				return {id: ececResult[1], url: linkValue, title: titleValue, updateDate: updateDate};
			})
			.filter((item): item is SubjectListItem => item !== null);
		const subjectNumText = dataHtml(".subject-num").text().trim();
		const totalNumMatch = subjectNumText.match(/\/\s*(\d+)/);
		if (!totalNumMatch && (rawItems.length > 0 || subjectNumText !== '0')) {
			throw new Error('Unable to read Douban list pagination total');
		}
		const totalNum = totalNumMatch ? parseInt(totalNumMatch[1], 10) : 0;
		if (!Number.isSafeInteger(totalNum) || (rawItems.length > 0 && totalNum < context.syncOffset + rawItems.length)) {
			throw new Error('Inconsistent Douban list pagination total');
		}
		if ((rawItems.length && !items.length) || (!rawItems.length && totalNum > context.syncOffset)) {
			throw new Error('Douban list contains no readable entries before the expected end');
		}
		return new SearchPage(
			totalNum,
			Math.floor(context.syncOffset / PAGE_SIZE) + 1,
			PAGE_SIZE,
			null,
			items,
		);
	}

	support(config: SyncConfig): boolean {
		return this.getDoType() == config.scope || ALL == config.scope;
	}

	static create(syncType: SyncType, doType: string): DoubanListHandler {
		return new class extends DoubanAbstractListHandler {
			getSyncType(): SyncType { return syncType; }
			getDoType(): string { return doType; }
		};
	}
}
