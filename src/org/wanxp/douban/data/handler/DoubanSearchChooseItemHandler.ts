import {App} from "obsidian";

import DoubanBookLoadHandler from "./DoubanBookLoadHandler";
import DoubanMovieLoadHandler from "./DoubanMovieLoadHandler";
import DoubanMusicLoadHandler from "./DoubanMusicLoadHandler";
import DoubanNoteLoadHandler from "./DoubanNoteLoadHandler";
import DoubanOtherLoadHandler from "./DoubanOtherLoadHandler";
import DoubanPlugin from "../../../main";
import DoubanSubject from "../model/DoubanSubject";
import DoubanSubjectLoadHandler from "./DoubanSubjectLoadHandler";
import {DoubanTeleplayLoadHandler} from "./DoubanTeleplayLoadHandler";
import DoubanGameLoadHandler from "./DoubanGameLoadHandler";
import HandleContext from "../model/HandleContext";
import HandleResult from "../model/HandleResult";
import DoubanTheaterLoadHandler from "./DoubanTheaterLoadHandler";
import {DoubanHttpUtil} from "../../../utils/DoubanHttpUtil";
import DoubanPageTypeDetector from "../../../utils/DoubanPageTypeDetector";
import {ParsedDoubanUrl} from "../../../utils/DoubanUrlUtil";
import {SupportType} from "../../../constant/Constsant";

export class DoubanSearchChooseItemHandler {

	private _app: App;
	private _doubanPlugin: DoubanPlugin;
	private _doubanSubjectHandlers: DoubanSubjectLoadHandler<DoubanSubject>[];
	private _doubanSubjectHandlerDefault: DoubanSubjectLoadHandler<DoubanSubject>;


	constructor(app: App, doubanPlugin: DoubanPlugin) {
		this._app = app;
		this._doubanPlugin = doubanPlugin;
		this._doubanSubjectHandlerDefault = new DoubanOtherLoadHandler(doubanPlugin);
		this._doubanSubjectHandlers = [new DoubanMovieLoadHandler(doubanPlugin), new DoubanBookLoadHandler(doubanPlugin),
			new DoubanTeleplayLoadHandler(doubanPlugin),
			new DoubanMusicLoadHandler(doubanPlugin),
			new DoubanNoteLoadHandler(doubanPlugin),
			new DoubanGameLoadHandler(doubanPlugin),
			new DoubanTheaterLoadHandler(doubanPlugin),
			this._doubanSubjectHandlerDefault];
	}

	public async handle(searchExtract: DoubanSubject, context: HandleContext): Promise<DoubanSubject | undefined> {
		if (!searchExtract) {
			return undefined;
		}
		let doubanSubjectHandlers: DoubanSubjectLoadHandler<DoubanSubject>[] = this._doubanSubjectHandlers
			.filter(h => h.support(searchExtract));
		if (doubanSubjectHandlers && doubanSubjectHandlers.length > 0) {
			return await doubanSubjectHandlers[0].handle(searchExtract.id, context);
		} else {
			return await this._doubanSubjectHandlerDefault.handle(searchExtract.id, context);
		}
	}

	public async handleUrl(parsed: ParsedDoubanUrl, context: HandleContext): Promise<DoubanSubject | undefined> {
		const html = await DoubanHttpUtil.httpRequestGet(
			parsed.url,
			context.plugin.settingsManager.getHeaders(),
			context.plugin.settingsManager,
		);
		const type = DoubanPageTypeDetector.detect(html, parsed.type) || parsed.type;
		const subject = {
			id: parsed.id,
			type,
			title: parsed.id,
			url: parsed.url,
		} as DoubanSubject;
		const handlers = this._doubanSubjectHandlers.filter(handler => handler.support(subject));
		const handler = handlers[0] || this._doubanSubjectHandlerDefault;
		if (handler.handleHtml) {
			const handlerContext: HandleContext = {
				...context,
				listItem: type === SupportType.theater ? subject : context.listItem,
				syncActive: false,
			};
			const result = await handler.handleHtml(parsed.id, html, handlerContext);
			context.importError = handlerContext.importError || '';
			return result;
		}
		return await handler.handle(parsed.id, context);
	}

	public async parseText(extract: DoubanSubject, context: HandleContext): Promise<HandleResult> {
		const doubanSubjectHandlers: DoubanSubjectLoadHandler<DoubanSubject>[] = this._doubanSubjectHandlers
			.filter(h => h.support(extract));
		if (doubanSubjectHandlers && doubanSubjectHandlers.length > 0) {
			const result = await doubanSubjectHandlers.map(h => h.parse(extract, context));
			if (result && result.length > 0) {
				return result[0];
			} else {
				return {content: ''};
			}
		} else {
			return this._doubanSubjectHandlerDefault.parse(extract, context);
		}

	}

}

