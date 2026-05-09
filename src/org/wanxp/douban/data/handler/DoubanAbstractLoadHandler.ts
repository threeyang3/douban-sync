import DoubanPlugin from "../../../main";
import DoubanSubject, {DoubanParameterName} from '../model/DoubanSubject';
import DoubanSubjectLoadHandler from "./DoubanSubjectLoadHandler";
import {moment, Platform, TFile} from "obsidian";
import {i18nHelper} from 'src/org/wanxp/lang/helper';
import {log} from "src/org/wanxp/utils/Logutil";
import {CheerioAPI, load} from "cheerio";
import YamlUtil, {TITLE_ALIASES_SPECIAL_CHAR_REG_G} from "../../../utils/YamlUtil";
import {
	BasicConst,
	DataValueType,
	PersonNameMode,
	PropertyName,
	SearchHandleMode,
	SupportType,
	TemplateKey,
	TemplateTextMode
} from "../../../constant/Constsant";
import HandleContext from "../model/HandleContext";
import HandleResult from "../model/HandleResult";
import {getDefaultTemplateContent} from "../../../constant/DefaultTemplateContent";
import StringUtil from "../../../utils/StringUtil";
import {DEFAULT_SETTINGS} from "../../../constant/DefaultSettings";
import {DoubanUserParameter, DoubanUserParameterName, UserStateSubject} from "../model/UserStateSubject";
import {
	DoubanSubjectState,
	DoubanSubjectStateRecords,
	DoubanSubjectStateRecords_KEY_WORD_TYPE
} from "../../../constant/DoubanUserState";
import {Person} from "schema-dts";
import HttpUtil from "../../../utils/HttpUtil";
import HtmlUtil from "../../../utils/HtmlUtil";
import {VariableUtil} from "../../../utils/VariableUtil";
import {DataField} from "../../../utils/model/DataField";
import {TemplateConfig, DoubanPluginSetting} from "../../setting/model/DoubanPluginSetting";
import NumberUtil from "../../../utils/NumberUtil";
import {DoubanHttpUtil} from "../../../utils/DoubanHttpUtil";
export default abstract class DoubanAbstractLoadHandler<T extends DoubanSubject> implements DoubanSubjectLoadHandler<T> {


	public doubanPlugin: DoubanPlugin;

	constructor(doubanPlugin: DoubanPlugin) {
		this.doubanPlugin = doubanPlugin;
	}

	async parse(extract: T, context: HandleContext): Promise<HandleResult> {
		const template: string = await this.getTemplate(extract, context);
		const variableMap = this.buildVariableMap(extract, context);
		this.parseUserInfo(template, variableMap, extract, context);
		this.parseVariable(template, variableMap, extract, context);
		await this.saveImage(extract, context, variableMap);

		const frontMatterStart: number = template.indexOf(BasicConst.YAML_FRONT_MATTER_SYMBOL, 0);
		const frontMatterEnd: number = template.indexOf(BasicConst.YAML_FRONT_MATTER_SYMBOL, frontMatterStart + 1);
		let frontMatter = '';
		let frontMatterBefore = '';
		let frontMatterAfter = '';
		let result = '';

		if (frontMatterStart > -1 && frontMatterEnd > -1) {
			frontMatterBefore = template.substring(0, frontMatterStart);
			frontMatter = template.substring(frontMatterStart, frontMatterEnd + 3);
			frontMatterAfter = template.substring(frontMatterEnd + 3);
			if (frontMatterBefore.length > 0) {
				frontMatterBefore = this.parsePartText(frontMatterBefore, extract, context, variableMap);
			}
			if (frontMatterAfter.length > 0) {
				frontMatterAfter = this.parsePartText(frontMatterAfter, extract, context, variableMap);
			}
			if (frontMatter.length > 0) {
				frontMatter = this.parsePartYml(frontMatter, extract, context, variableMap);
			}
			result = frontMatterBefore + frontMatter + frontMatterAfter;
		} else {
			result = this.parsePartText(template, extract, context, variableMap);
		}
		// 检测未解析的模板变量并警告
		this.warnUnresolvedVariables(result, template);
		let filePath = '';
		if (SearchHandleMode.FOR_CREATE == context.mode) {
			filePath = this.parsePartPath(this.getFilePath(context), extract, context, variableMap);
		}
		let fileName = '';
		if (SearchHandleMode.FOR_CREATE == context.mode) {
			fileName = this.parsePartPath(this.getFileName(context), extract, context, variableMap);
		}
		return {content: result,filePath: filePath, fileName: fileName, subject:extract};
	}

	/**
	 * 检测处理后内容中未解析的模板变量并输出警告
	 */
	private warnUnresolvedVariables(result: string, originalTemplate: string): void {
		// 检测 {{doubleBrace}} 格式的未解析变量（标准格式）
		const unresolvedDouble = result.match(/\{\{[a-zA-Z0-9_]+\}\}/g);
		if (unresolvedDouble && unresolvedDouble.length > 0) {
			log.warn(`模板变量未解析: ${unresolvedDouble.join(', ')}，请检查模板语法是否正确（应使用 {{变量名}} 格式）`);
		}
		// 检测 { singleBrace } 格式的变量（常见错误格式）
		const unresolvedSingle = result.match(/\{\s*[a-zA-Z0-9_]+\s*\}/g);
		if (unresolvedSingle && unresolvedSingle.length > 0) {
			log.warn(`检测到可能的模板语法错误: ${unresolvedSingle.join(', ')}，模板变量应使用 {{双花括号}} 格式，而非 { 单花括号 }`);
		}
	}

	private getFileName(context: HandleContext): string {
		const {syncConfig} = context;
		if (syncConfig) {
			return syncConfig.dataFileNamePath;
		}
		const {dataFileNamePath} = context.settings;
		return dataFileNamePath ? dataFileNamePath : DEFAULT_SETTINGS.dataFileNamePath;
	}

	private getFilePath(context: HandleContext): string {
		const {syncConfig} = context;
		if (syncConfig) {
			return syncConfig.dataFilePath;
		}
		const {dataFilePath} = context.settings;
		return dataFilePath ? dataFilePath : DEFAULT_SETTINGS.dataFilePath;
	}





	abstract getSupportType(): SupportType;

	abstract parseVariable(beforeContent: string, variableMap:Map<string, DataField>, extract: T, context: HandleContext): void;

	abstract support(extract: DoubanSubject): boolean;

	async handle(id: string, context: HandleContext): Promise<T> {
		const url:string = this.getSubjectUrl(id);
		context.plugin.settingsManager.debug(`开始请求地址:${url}`)
		context.plugin.settingsManager.debug(`(注意:请勿向任何人透露你的Cookie,此处若需要截图请**打码**)请求header:${context.settings.loginHeadersContent}`)
		return await DoubanHttpUtil.httpRequestGet(url, context.plugin.settingsManager.getHeaders(), context.plugin.settingsManager)
			.then(load)
			.then(data => this.analysisUserState(data, context))
			.then(({data, userState}) => {
				let guessType = this.getSupportType();
				if (context.syncActive) {
					guessType = this.getGuessType(data);
				}
				const sub = this.parseSubjectFromHtml(data, context);
				if (!sub) {
					// M-hM-7M-#M-fM-^^M-^PM-eM--1M-hM-4M-%M-fM-^WM-6M-oM-<M-^LM-hM-^KM-%M-gM-1M-;M-eM-^^M-^KM-dM-8M-^MM-eM-^LM-9M-iM-^EM-^MM-oM-<M-^LM-fM- M-^GM-hM-.M-0M-dM-8M-: failByDiffType M-hM-^@M-^LM-iM-^]M-^^M-fM-^IM-)M-fM-;M-^BM-iM-^@M-^ZM fail
					if (context.syncActive && guessType && guessType !== this.getSupportType()) {
						const id = StringUtil.analyzeIdByUrl(url);
						context.syncStatusHolder?.syncStatus.failByDiffType(id, '',
							`${i18nHelper.getMessage(guessType)} -> ${i18nHelper.getMessage(this.getSupportType())}`);
						return undefined;
					}
					throw new Error('parseSubjectFromHtml returned null');
				}
				sub.imageUrl = this.normalizeImageUrl(sub.imageUrl);
				// 从云端获取的 title 可能包含各类引号（如《"解忧杂货店"》），统一去除
				sub.title = sub.title?.replace(/[""“”＂«»‘’「」『』]/g, '') ?? sub.title;
				sub.userState = userState;
				sub.guessType = guessType;
				return sub;
			})
			.then(content => this.toEditor(context, content))
			.catch(e =>  {
				log.error(i18nHelper.getMessage('130101',  e.toString()), e);
				if (url) {
					const id = StringUtil.analyzeIdByUrl(url);
					context.syncStatusHolder?context.syncStatusHolder.syncStatus.fail(id, ''):null;
				}else {
					context.syncStatusHolder?context.syncStatusHolder.syncStatus.handled(1):null;
				}
				return undefined;
			});


	}

	/**
	 * 通过判断 data中是否包含关键字符串 “我看过的电视剧” 判断是不是 movie
	 * @param data
	 * @private
	 */
	private getGuessType(data: CheerioAPI):SupportType {
		if (data) {
			const text = data.html();
			if (text) {
				for (const [key, value] of DoubanSubjectStateRecords_KEY_WORD_TYPE) {
					if (text.indexOf(key) >= 0) {
						return value;
					}
				}
			}
			// 关键词匹配失败时，尝试从 JSON-LD 和 og:type 推断类型
			const ldJsonType = this.getGuessTypeFromJsonLd(data);
			if (ldJsonType) {
				return ldJsonType;
			}
			const ogType = this.getGuessTypeFromOgType(data);
			if (ogType) {
				return ogType;
			}
		}
		return null;
	}

	/**
	 * 从 JSON-LD @type 推断内容类型
	 */
	private getGuessTypeFromJsonLd(data: CheerioAPI): SupportType | null {
		const ldJsonMap: Record<string, SupportType> = {
			'Book': SupportType.book,
			'Movie': SupportType.movie,
			'TVSeries': SupportType.teleplay,
			'MusicAlbum': SupportType.music,
			'VideoGame': SupportType.game,
		};
		try {
			const scripts = data('script').get();
			for (const s of scripts) {
				if (data(s).attr('type') === 'application/ld+json') {
					const text = data(s).text();
					if (text) {
						const obj = JSON.parse(text.replace(/[\r\n\t]+/g, ''));
						const type = obj['@type'];
						if (type && ldJsonMap[type]) {
							return ldJsonMap[type];
						}
					}
					break;
				}
			}
		} catch (_) { /* ignore parse errors */ }
		return null;
	}

	/**
	 * 从 og:type 推断内容类型
	 */
	private getGuessTypeFromOgType(data: CheerioAPI): SupportType | null {
		const ogTypeMap: Record<string, SupportType> = {
			'book': SupportType.book,
			'video.movie': SupportType.movie,
			'video.tv_show': SupportType.teleplay,
			'music.album': SupportType.music,
			'video.other': SupportType.game,
		};
		try {
			const ogType = data('meta[property="og:type"]').attr('content');
			if (ogType && ogTypeMap[ogType]) {
				return ogTypeMap[ogType];
			}
		} catch (_) { /* ignore parse errors */ }
		return null;
	}


	abstract parseSubjectFromHtml(data: CheerioAPI, context: HandleContext): T | undefined;

	async toEditor(context: HandleContext, extract: T): Promise<T> {
		await this.doubanPlugin.putToObsidian(context, extract);
		return extract;
	}

	getPersonName(name: string, context: HandleContext): string {
		return this.getPersonNameByMode(name, context.settings.personNameMode);
	}

	getPersonName2(originalName: string, chineseName: string, context: HandleContext): string {
		return this.getPersonNameByMode2(originalName, chineseName, context.settings.personNameMode);
	}


	getPersonNameByMode2(originalName: string, chineseName: string, personNameMode: string): string {
		if (!originalName || !personNameMode) {
			return "";
		}
		let resultName: string;
		switch (personNameMode) {
			case PersonNameMode.CH_NAME:
				resultName = chineseName;
				break;
			case PersonNameMode.EN_NAME:
				resultName  = originalName.trim().replace(chineseName, '').trim();
				if (!resultName) {
					resultName = originalName;
				}
				break;
			default:
				resultName = originalName;
		}
		return resultName;
	}


	getPersonNameByMode(name: string, personNameMode: string): string {
		if (!name || !personNameMode) {
			return "";
		}
		let resultName: string;
		let regValue: RegExpExecArray;
		switch (personNameMode) {
			case PersonNameMode.CH_NAME:
				regValue = /[\u4e00-\u9fa50-9. ·:\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5()]{2,}/g.exec(name);
				resultName = regValue ? regValue[0] : name;
				break;
			case PersonNameMode.EN_NAME:
				regValue = /[0-9a-zA-Z.\s-:]{2,}/g.exec(name);
				resultName = regValue ? regValue[0] : name;
				break;
			default:
				resultName = name;
		}
		return resultName.trim();
	}

	getTitleNameByMode(name: string, personNameMode: string, context: HandleContext): string {
		if (!name || !personNameMode) {
			return "";
		}
		if (context.listItem) {
			const newName = context.listItem.title.trim().replaceAll(' ', '');
			switch (personNameMode) {
				case PersonNameMode.CH_NAME:
					return newName;
					break;
				case PersonNameMode.EN_NAME:
					return name.trim().replaceAll(' ', '').replaceAll(newName, '');
                    break;
			}
		}
		return this.getPersonNameByMode(name, personNameMode);
	}

	html_decode(str: string): string {
		let s = "";
		if (str.length == 0) return "";
		s = str.replace(/&amp;/g, "&");
		s = s.replace(/&lt;/g, "<");
		s = s.replace(/&gt;/g, ">");
		s = s.replace(/&nbsp;/g, " ");
		s = s.replace(/&#39;/g, "'");
		s = s.replace(/&quot;/g, "\"");
		s = s.replace(/<br\/>/g, "\n");
		return s;
	}

	private parsePartYml(template: string, extract: T, context: HandleContext,  variableMap : Map<string, DataField>): string {
		return VariableUtil.replaceSubject(variableMap, template, this.getSupportType(), this.doubanPlugin.settingsManager, 'yml_text');
	}

	private parsePartText(template: string, extract: T, context: HandleContext,  variableMap : Map<string, DataField>): string {
		return VariableUtil.replaceSubject(variableMap, template, this.getSupportType(), this.doubanPlugin.settingsManager, 'text');
	}

	private parsePartPath(template: string, extract: T, context: HandleContext,  variableMap : Map<string, DataField>): string {
		return VariableUtil.replaceSubject(variableMap, template, this.getSupportType(), this.doubanPlugin.settingsManager, 'path');
	}

	private buildVariableMap(extract: T, context: HandleContext) {
		const variableMap: Map<string, DataField> = new Map();
		for (const [key, value] of Object.entries(extract)) {
			if (!value) {
				continue;
			}
			const type: DataValueType = VariableUtil.getType(value);
			if (key == 'score') {
				variableMap.set(DoubanParameterName.SCORE_STAR, new DataField(
					DoubanParameterName.SCORE_STAR,
					DataValueType.string,
					value,
					NumberUtil.getRateStar(value, 10, {scoreSetting: context.settings.scoreSetting})
				));
			}
			variableMap.set(key, new DataField(key, type, value, value));
		}
		variableMap.set(DoubanParameterName.IMAGE_URL, new DataField(
			DoubanParameterName.IMAGE_URL,
			DataValueType.url,
			extract.imageUrl,
			extract.imageUrl
		));
		variableMap.set(DoubanParameterName.YEAR_PUBLISHED, new DataField(
			DoubanParameterName.YEAR_PUBLISHED,
			DataValueType.date,
			extract.datePublished,
			extract.datePublished ? moment(extract.datePublished).format('yyyy') : ''
		));
		variableMap.set(DoubanParameterName.DATE_PUBLISHED, new DataField(
			DoubanParameterName.DATE_PUBLISHED,
			DataValueType.date,
			extract.datePublished,
			extract.datePublished ? moment(extract.datePublished).format(context.settings.dateFormat) : ''
		));
		variableMap.set(DoubanParameterName.TIME_PUBLISHED, new DataField(
			DoubanParameterName.TIME_PUBLISHED,
			DataValueType.date,
			extract.datePublished,
			extract.datePublished ? moment(extract.datePublished).format(context.settings.timeFormat) : ''
		));
		const currentDate = new Date();
		variableMap.set(DoubanParameterName.CURRENT_DATE, new DataField(
			DoubanParameterName.CURRENT_DATE,
			DataValueType.date,
			currentDate,
			moment(currentDate).format(context.settings.dateFormat)
		));
		variableMap.set(DoubanParameterName.CURRENT_TIME, new DataField(
			DoubanParameterName.CURRENT_TIME,
			DataValueType.date,
			currentDate,
			moment(currentDate).format(context.settings.timeFormat)
		));
		return variableMap;
	}

	private parseUserInfo(resultContent: string, variableMap:Map<string, DataField>, extract: T, context: HandleContext) {
		const userState = extract.userState;
		if ((resultContent.indexOf(DoubanUserParameter.MY_TAGS) >= 0 ||
			resultContent.indexOf(DoubanUserParameter.MY_RATING) >= 0 ||
			resultContent.indexOf(DoubanUserParameter.MY_STATE) >= 0 ||
			resultContent.indexOf(DoubanUserParameter.MY_COMMENT) >= 0 ||
			resultContent.indexOf(DoubanUserParameter.MY_COLLECTION_DATE) >= 0 ) && !this.doubanPlugin.userComponent.isLogin()) {
			log.warn(i18nHelper.getMessage('100113'));
			return resultContent;
		}
		if (!userState) {
			return resultContent;
		}
		let tags: string[] = [];
		if (userState.tags && userState.tags.length > 0 ) {
			tags = userState.tags.map(tag => tag.trim());
		}
		Object.entries(userState).forEach(([key, value]) => {
			if (!value) {
				return;
			}
			variableMap.set(key, new DataField(key, VariableUtil.getType(value), value, value));
		});
		variableMap.set(DoubanUserParameterName.MY_TAGS, new DataField(DoubanUserParameterName.MY_TAGS, DataValueType.array, tags, tags));
		if (userState.comment) {
			variableMap.set(DoubanUserParameterName.MY_COMMENT, new DataField(
				DoubanUserParameterName.MY_COMMENT,
				DataValueType.string,
				userState.comment,
				userState.comment
			));
		}
		if (userState.state) {
			variableMap.set(DoubanUserParameterName.MY_STATE, new DataField(
				DoubanUserParameterName.MY_STATE,
				DataValueType.string,
				userState.state,
				userState.stateName || this.getUserStateName(userState.state)
			));
		}
		if (userState.rate) {
			variableMap.set(DoubanUserParameterName.MY_RATING, new DataField(
				DoubanUserParameterName.MY_RATING,
				DataValueType.number,
				userState.rate,
				userState.rate)
			);
			variableMap.set(DoubanUserParameterName.MY_RATING_STAR, new DataField(
				DoubanUserParameterName.MY_RATING_STAR,
				DataValueType.string,
				userState.rate,
				NumberUtil.getRateStar(userState.rate, 5, {scoreSetting: context.settings.scoreSetting})
			));
		}
		if (userState.collectionDate) {
			variableMap.set(DoubanUserParameterName.MY_COLLECTION_DATE, new DataField(
				DoubanUserParameterName.MY_COLLECTION_DATE,
				DataValueType.date,
				userState.collectionDate,
				userState.collectionDate ? moment(userState.collectionDate).format(context.settings.dateFormat) : ''
			));
		}

	}



	private getTemplateKeys(): { templateKey: TemplateKey; configKey: keyof DoubanPluginSetting } {
		switch (this.getSupportType()) {
			case SupportType.movie:  return { templateKey: TemplateKey.movieTemplateFile,     configKey: 'movieTemplateConfig' };
			case SupportType.book:   return { templateKey: TemplateKey.bookTemplateFile,      configKey: 'bookTemplateConfig' };
			case SupportType.music:  return { templateKey: TemplateKey.musicTemplateFile,     configKey: 'musicTemplateConfig' };
			case SupportType.teleplay: return { templateKey: TemplateKey.teleplayTemplateFile, configKey: 'teleplayTemplateConfig' };
			case SupportType.game:   return { templateKey: TemplateKey.gameTemplateFile,      configKey: 'gameTemplateConfig' };
			case SupportType.note:   return { templateKey: TemplateKey.noteTemplateFile,      configKey: 'noteTemplateConfig' };
			default: return { templateKey: null, configKey: null };
		}
	}

	private async getTemplate(extract: T, context: HandleContext): Promise<string> {
		const {syncConfig} = context;
		if (syncConfig) {
			if(syncConfig.templateFile) {
				const val = await this.doubanPlugin.fileHandler.getFileContent(syncConfig.templateFile);
				if (val) {
					return val;
				}
			}
		}
		const { templateKey: tempKey, configKey } = this.getTemplateKeys();
		const rawConfig = context.settings[configKey];
		let config: TemplateConfig;
		if (rawConfig && typeof rawConfig === 'object' && 'source' in rawConfig) {
			config = rawConfig as TemplateConfig;
		} else if (rawConfig && typeof rawConfig === 'string') {
			config = { source: 'file', filePath: rawConfig };
		} else {
			config = { source: 'builtin' };
		}
		const useUserState = context.userComponent.isLogin() &&
			!!extract.userState &&
			extract.userState.collectionDate != null;

		if (config.source === 'builtin') {
			return getDefaultTemplateContent(tempKey, useUserState);
		}

		if (config.source === 'file' && config.filePath) {
			const firstLinkpathDest: TFile = this.doubanPlugin.app.metadataCache.getFirstLinkpathDest(config.filePath, '');
			if (firstLinkpathDest) {
				const val = await this.doubanPlugin.fileHandler.getFileContent(firstLinkpathDest.path);
				if (val) return val;
			}
			return getDefaultTemplateContent(tempKey, useUserState);
		}

		if (config.source === 'custom' && config.customContent) {
			return config.customContent;
		}

		return getDefaultTemplateContent(tempKey, useUserState);
	}

	analysisUserState(html: CheerioAPI, context: HandleContext): {data:CheerioAPI ,  userState: UserStateSubject} {
		if (!context.userComponent.isLogin()) {
			return {data: html, userState: null};
		}
		if(html('.nav-user-account').length === 0) {
			return {data: html, userState: null};
		}
		return this. analysisUser(html, context);
	}

	abstract analysisUser(html: CheerioAPI, context: HandleContext): {data:CheerioAPI ,  userState: UserStateSubject};


	public static getUserState(stateWord:string):DoubanSubjectState {
		let state:DoubanSubjectState;
		if(!stateWord) {
			return null;
		}
		if(stateWord.indexOf('想')>=0 ) {
			state = DoubanSubjectState.wish;
		}else if(stateWord.indexOf('在')>=0) {
			state = DoubanSubjectState.do;
		}else if(stateWord.indexOf('过')>=0) {
			state = DoubanSubjectState.collect;
		}else {
			state = DoubanSubjectState.not;
		}
		return state;

	}

	private getUserStateName(state: DoubanSubjectState): string {
		if (!state) {
			return '';
		}
		const v = DoubanSubjectStateRecords[this.getSupportType()];
		switch (state) {
			case DoubanSubjectState.wish:
				return v.wish;
			case DoubanSubjectState.do:
				return v.do;
			case DoubanSubjectState.collect:
				return v.collect;
			case DoubanSubjectState.not:
				return v.not;
			default:
				return '';
		}
	}

	private async saveImage(extract: T, context: HandleContext, variableMap : Map<string, DataField>) {
		const {syncConfig} = context;
		if (!extract.image || (syncConfig && !syncConfig.cacheImage)  || !context.settings.cacheImage) {
			return;
		}
		const image = extract.image;
		let folder = syncConfig? syncConfig.attachmentPath : context.settings.attachmentPath;
		if (!folder) {
			folder = DEFAULT_SETTINGS.attachmentPath;
		}
		folder = this.parsePartPath(folder, extract, context, variableMap)
		let fileName = syncConfig? syncConfig.attachmentFileName : context.settings.attachmentFileName;
		if (!fileName) {
			fileName = DEFAULT_SETTINGS.attachmentFileName;
		}
		let fileNameSuffix = image ? image.substring(image.lastIndexOf('.')) : '.jpg';
		if (fileNameSuffix && fileNameSuffix.length > 10) {
			fileNameSuffix = '.jpg';
		}
		fileName = this.parsePartPath(fileName, extract, context, variableMap)
		fileName = fileName + fileNameSuffix;
		const overwriteCoverImage = syncConfig ? (syncConfig.overwriteCoverImage ?? false) : context.settings.overwriteCoverImage;
		// 封面已存在且未勾选覆盖时跳过下载，加速替换同步
		if (!overwriteCoverImage) {
			const existingPath = folder.replace(/\\/g, '/') + '/' + fileName;
			const existing = context.plugin.app.vault.getAbstractFileByPath(existingPath);
			if (existing instanceof TFile) {
				extract.image = existingPath;
				extract.imageUrl = image;
				this.initImageVariableMap(extract, context, variableMap);
				return;
			}
		}
		const imageReferer = (extract.id ? this.getSubjectUrl(extract.id) : '') || extract.url;
		const referHeaders = HttpUtil.buildImageRequestHeaders(
			context.plugin.settingsManager.getHeaders() as Record<string, any>,
			imageReferer
		);
		if ((syncConfig ? syncConfig.cacheHighQuantityImage : context.settings.cacheHighQuantityImage) && context.userComponent.isLogin()) {
			try {
				const highImageFilename = this.getImageFilename(image);
				const highImage = this.getHighQuantityImageUrl(highImageFilename);
				const highImageHeaders = HttpUtil.buildImageRequestHeaders(
					context.plugin.settingsManager.getHeaders() as Record<string, any>,
					imageReferer
				);
				const resultValue = await this.handleImage(highImage, folder, fileName, context, false, highImageHeaders, overwriteCoverImage);
				if (resultValue && resultValue.success) {
					extract.image = resultValue.filepath;
					extract.imageUrl = highImage;
					this.initImageVariableMap(extract, context, variableMap);
					return;
				}
			}catch (e) {
				console.error(e);
				console.error('下载高清封面失败，将会使用普通封面')
			}
		}
		const resultValue = await this.handleImage(image, folder, fileName, context, true, referHeaders, overwriteCoverImage);
		if (resultValue && resultValue.success) {
			extract.image = resultValue.filepath;
			this.initImageVariableMap(extract, context, variableMap);
		}
	}

	private getImageFilename(image: string): string {
		if (!image) {
			return '';
		}
		const imageUrl = image.split('?').first() || image;
		return imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
	}

	private initImageVariableMap(extract: T, context: HandleContext, variableMap : Map<string, DataField>) {
		variableMap.set(DoubanParameterName.IMAGE_URL, new DataField(
			DoubanParameterName.IMAGE_URL,
			DataValueType.url,
			extract.imageUrl,
			extract.imageUrl
		));
		variableMap.set(DoubanParameterName.IMAGE, new DataField(
			DoubanParameterName.IMAGE,
			DataValueType.path,
			extract.image,
			extract.image
		));

	}

	private async handleImage(image: string, folder: string, filename: string, context: HandleContext, showError: boolean, headers?: any, overwrite: boolean = false) {
		//只有在桌面版且开启了图片上传才会使用PicGo，并且开启图床功能
		if (context.settings.pictureBedFlag && Platform.isDesktopApp) {
			//临时限定只支持PicGo
			const checked = await context.netFileHandler.downloadDBUploadPicGoByClipboardBefore(context);
			if (!checked) {
				//TODO 国际化
				log.notice('连接PicGo软件失败, 请检查是否已开启PicGo的Server服务 或 检查插件中配置地址是否正确，现使用默认的下载到本地的方式');
				return  await context.netFileHandler.downloadDBFile(image, folder, filename, context, false, headers, overwrite);
			}
			return await context.netFileHandler.downloadDBUploadPicGoByClipboard(image, filename, context, showError, headers);
		}else {
			return  await context.netFileHandler.downloadDBFile(image, folder, filename, context, false, headers, overwrite);
		}

	}

	abstract getHighQuantityImageUrl(fileName:string):string;

	abstract getSubjectUrl(id:string):string;

	/**
	 * 规范化豆瓣封面图片 URL：统一使用 img9 子域和 getHighQuantityImageUrl 的路径格式
	 * 解决豆瓣 CDN 随机子域（img1~img8）导致的封面链接不可访问问题
	 */
	normalizeImageUrl(imageUrl: string): string {
		if (!imageUrl) {
			return imageUrl;
		}
		const fileName = this.getImageFilename(imageUrl);
		if (!fileName) {
			return imageUrl;
		}
		const normalized = this.getHighQuantityImageUrl(fileName);
		return normalized || imageUrl;
	}

	handlePersonNameByMeta(html: CheerioAPI, movie: DoubanSubject, context: HandleContext,
								   metaProperty:string, objectProperty:string) {
		if (!movie) {
			return;
		}
		const metaProperties: string[] = html(`head > meta[property='${metaProperty}']`).get()
			.map((e) => {
				return html(e).attr('content');
			});
		// @ts-ignore
		const currentArray = movie[objectProperty];
		if (!Array.isArray(currentArray)) {
			return;
		}
		// @ts-ignore
		currentArray
			// @ts-ignore
			.filter((p:Person) => p.name)
			// @ts-ignore
			.map((p:Person) => {
				// @ts-ignore
				const persons = metaProperties.filter((a) => p.name.indexOf(a) >= 0);
				if (persons) {
					// @ts-ignore
					p.name = this.getPersonName2(p.name, persons[0], context);
				}
			})
	}


	protected getPropertyValue(html: CheerioAPI, name: PropertyName): string {
		return HtmlUtil.getHtmlText(html, this.doubanPlugin.settingsManager.getSelector(this.getSupportType(), name));
	}

	/**
	 * 过滤掉被误识别为短评的标签文本
	 */
	protected filterCommentText(text: string): string {
		if (!text) {
			return '';
		}
		if (/^标签[:：]/.test(text.trim())) {
			return '';
		}
		return text;
	}


}
