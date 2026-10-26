import {CheerioAPI} from 'cheerio';
import {moment} from "obsidian";
import DoubanAbstractLoadHandler from "./DoubanAbstractLoadHandler";
import DoubanPlugin from "../../../main";
import SchemaOrg from "src/org/wanxp/utils/SchemaOrg";
import DoubanSubject from '../model/DoubanSubject';
import HandleContext from "../model/HandleContext";
import {DataValueType, PropertyName, SupportType} from "../../../constant/Constsant";
import {UserStateSubject} from "../model/UserStateSubject";
import {TITLE_ALIASES_SPECIAL_CHAR_REG_G} from "../../../utils/YamlUtil";
import DoubanTheaterSubject from "../model/DoubanTheaterSubject";
import {DataField} from "../../../utils/model/DataField";
import DoubanPageParser from "../../../utils/DoubanPageParser";
import StringUtil from "../../../utils/StringUtil";

const THEATER_FIELD_ALIASES: Record<string, string[]> = {
	genre: ['类型', '剧目类型'],
	director: ['导演'],
	author: ['编剧'],
	actor: ['主演', '演员'],
	publisher: ['演出团体', '演出剧院', '出品方'],
	language: ['语言'],
	originalTitle: ['原名'],
	aliases: ['又名', '别名'],
	datePublished: ['演出日期', '演出时间', '首演日期'],
};

export default class DoubanTheaterLoadHandler extends DoubanAbstractLoadHandler<DoubanTheaterSubject> {
	constructor(doubanPlugin: DoubanPlugin) {
		super(doubanPlugin);
	}

	getSupportType(): SupportType {
		return SupportType.theater;
	}

	getHighQuantityImageUrl(fileName: string): string {
		return `https://img9.doubanio.com/pview/drama_subject_poster/large/public/${fileName}`;
	}

	getSubjectUrl(id: string): string {
		return `https://www.douban.com/location/drama/${id}/`;
	}

	parseVariable(
		_beforeContent: string,
		variableMap: Map<string, DataField>,
		extract: DoubanTheaterSubject,
		context: HandleContext,
	): void {
		variableMap.set("director", new DataField(
			"director",
			DataValueType.array,
			extract.director,
			(extract.director || []).map(SchemaOrg.getPersonName).filter(Boolean),
		));
		variableMap.set("actor", new DataField(
			"actor",
			DataValueType.array,
			extract.actor,
			(extract.actor || []).map(SchemaOrg.getPersonName).filter(Boolean),
		));
		variableMap.set("author", new DataField(
			"author",
			DataValueType.array,
			extract.author,
			(extract.author || []).map(SchemaOrg.getPersonName)
				.map(name => super.getPersonName(name, context))
				.filter(Boolean),
		));
		variableMap.set("aliases", new DataField(
			"aliases",
			DataValueType.array,
			extract.aliases,
			(extract.aliases || []).map(alias => alias
				.trim()
				.replace(TITLE_ALIASES_SPECIAL_CHAR_REG_G, '_')
				.replace(/_+/g, '_')
				.replace(/^_/, '')
				.replace(/_$/, '')),
		));
	}

	support(extract: DoubanSubject): boolean {
		return !!extract && (
			extract.url?.includes('/location/drama/')
			|| extract.type === SupportType.theater
			|| /舞台剧|音乐剧|话剧|舞剧|歌剧|戏曲|脱口秀|Theater/i.test(extract.type || '')
		);
	}

	analysisUser(html: CheerioAPI, context: HandleContext): {data: CheerioAPI, userState: UserStateSubject} {
		const rate = html('input#n_rating').val();
		const tags = DoubanPageParser.parseUserTags(html);
		const stateWord = html('#interest_sect_level .mr10').first().text().trim()
			|| html('#interest_sect_level > h2').text().trim();
		const collectionDateStr = html('#interest_sect_level .collection_date').first().text().trim();
		const comment = DoubanPageParser.parseUserComment(
			html,
			this.doubanPlugin.settingsManager.getSelector(this.getSupportType(), PropertyName.comment),
		);
		return {
			data: html,
			userState: {
				tags,
				rate: rate ? Number(rate) : null,
				state: DoubanAbstractLoadHandler.getUserState(stateWord),
				collectionDate: collectionDateStr ? moment(collectionDateStr, 'YYYY-MM-DD').toDate() : null,
				comment: this.filterCommentText(comment),
			},
		};
	}

	parseSubjectFromHtml(html: CheerioAPI, context: HandleContext): DoubanTheaterSubject {
		const canonicalUrl = this.firstAttribute(html, [
			"link[rel='canonical']",
			"meta[property='og:url']",
		], 'href', 'content');
		const pageId = this.firstAttribute(html, [
			'[data-object_id]',
			'[share-id]',
			"[data-url*='/location/drama/']",
		], 'data-object_id', 'share-id') || this.findIdInScripts(html);
		const url = canonicalUrl
			|| html("[data-url*='/location/drama/']").first().attr('data-url')
			|| context.listItem?.url
			|| '';
		const id = StringUtil.analyzeIdByUrl(url)
			|| pageId
			|| StringUtil.analyzeIdByUrl(context.listItem?.url || '');
		const values = this.collectFields(html);
		const title = DoubanPageParser.normalizeText(
			html(".drama-info [itemprop='name']").first().text()
			|| html('.drama-info h1').first().text()
			|| html('h1').first().text()
			|| html("meta[property='og:title']").attr('content')
			|| context.listItem?.title
			|| '',
		);
		const image = html(".drama-info [itemprop='image']").attr('src')
			|| html('.drama-info .poster img, .drama-info img, .poster img').first().attr('src')
			|| html("meta[property='og:image']").attr('content')
			|| '';
		const dateText = this.firstField(values, 'datePublished');
		const dateMatch = dateText.match(/\d{4}[-./年]\d{1,2}(?:[-./月]\d{1,2}日?)?/);
		const normalizedDate = dateMatch
			? dateMatch[0].replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\./g, '-').replace(/\/+/g, '-')
			: '';
		const scoreText = html(".drama-info [itemprop='ratingValue']").first().text()
			|| html("#interest_sectl strong[property='v:average']").first().text();
		const desc = DoubanPageParser.extractText(html, [
			'.drama-info .intro p',
			'.drama-info .intro',
			'.drama-info .pure-text',
			'.article .mod .pure-text',
			'#link-report .intro p',
			'.subject-intro p',
		]) || DoubanPageParser.normalizeText(html("meta[property='og:description']").attr('content') || '');

		return {
			id,
			title,
			type: this.getSupportType(),
			score: Number(scoreText) || null,
			image,
			imageUrl: image,
			url: url || (id ? this.getSubjectUrl(id) : ''),
			desc,
			publisher: (values.get('publisher') || []).join(' / '),
			datePublished: normalizedDate ? new Date(normalizedDate) : undefined,
			genre: values.get('genre') || [],
			director: values.get('director') || [],
			author: values.get('author') || [],
			actor: values.get('actor') || [],
			aggregateRating: undefined,
			originalTitle: this.firstField(values, 'originalTitle'),
			aliases: values.get('aliases') || [],
			language: values.get('language') || [],
		};
	}

	private collectFields(html: CheerioAPI): Map<string, string[]> {
		const result = new Map<string, string[]>();
		html('.drama-info .meta dl dt, .drama-info dl dt, .mod dl dt, #info dt').each((_index, element) => {
			const rawLabel = DoubanPageParser.normalizeText(html(element).text()).replace(/[：:]$/, '');
			const field = Object.entries(THEATER_FIELD_ALIASES)
				.find(([, aliases]) => aliases.includes(rawLabel))?.[0];
			if (!field) {
				return;
			}
			const valueElement = html(element).next('dd');
			const linkedValues = valueElement.find("[itemprop='name'], a").get()
				.map(item => DoubanPageParser.normalizeText(html(item).text()))
				.filter(Boolean);
			const rawValue = DoubanPageParser.normalizeText(valueElement.text());
			const parsedValues = linkedValues.length > 0
				? linkedValues
				: rawValue.split(/\s*\/\s*/).filter(Boolean);
			result.set(field, Array.from(new Set([
				...(result.get(field) || []),
				...parsedValues,
			])));
		});
		return result;
	}

	private firstField(values: Map<string, string[]>, key: string): string {
		return values.get(key)?.[0] || '';
	}

	private firstAttribute(
		html: CheerioAPI,
		selectors: string[],
		...attributes: string[]
	): string {
		for (const selector of selectors) {
			const element = html(selector).first();
			for (const attribute of attributes) {
				const value = element.attr(attribute);
				if (value) {
					return value;
				}
			}
		}
		return '';
	}

	private findIdInScripts(html: CheerioAPI): string {
		for (const element of html('script').get()) {
			const match = html(element).text().match(/_subject_\s*=\s*\{[^}]*\bid\s*:\s*["'](\d+)["']/);
			if (match?.[1]) {
				return match[1];
			}
		}
		return '';
	}
}
