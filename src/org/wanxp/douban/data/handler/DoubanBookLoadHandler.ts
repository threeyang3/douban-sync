import {CheerioAPI} from 'cheerio';
import DoubanAbstractLoadHandler from "./DoubanAbstractLoadHandler";
import DoubanBookSubject, {DoubanBookParameter} from "../model/DoubanBookSubject";
import DoubanPlugin from "../../../main";
import DoubanSubject from "../model/DoubanSubject";
import {DataValueType, PropertyName, SupportType, TemplateTextMode} from "../../../constant/Constsant";
import HandleContext from "../model/HandleContext";
import StringUtil from "../../../utils/StringUtil";
import {UserStateSubject} from "../model/UserStateSubject";
import {moment} from "obsidian";
import {DataField} from "../../../utils/model/DataField";

export default class DoubanBookLoadHandler extends DoubanAbstractLoadHandler<DoubanBookSubject> {

	constructor(doubanPlugin: DoubanPlugin) {
		super(doubanPlugin);
	}

	getSupportType(): SupportType {
		return SupportType.book;
	}

	getHighQuantityImageUrl(fileName:string):string{
		return `https://img9.doubanio.com/view/subject/l/public/${fileName}`;
	}

	getSubjectUrl(id:string):string{
		return `https://book.douban.com/subject/${id}/`;
	}

	parseVariable(beforeContent: string, variableMap:Map<string, DataField>, extract: DoubanBookSubject, context: HandleContext): void {
		variableMap.set(DoubanBookParameter.author, new DataField(DoubanBookParameter.author,
			DataValueType.array, extract.author, (extract.author || []).map(this.handleSpecialAuthorName)));
		variableMap.set(DoubanBookParameter.translator, new DataField(DoubanBookParameter.translator,
			DataValueType.array, extract.translator, (extract.translator || []).map(this.handleSpecialAuthorName)));
	}

	support(extract: DoubanSubject): boolean {
		return extract && extract.type && (extract.type.contains("图书") || extract.type.contains("书籍") || extract.type.contains("Book") || extract.type.contains("book"));
	}

	handleSpecialAuthorName(authorName: string): string {
		return authorName.replace(/\[/g, '')
			.replace(']', '/');
	}

	analysisUser(html: CheerioAPI, context: HandleContext): {data:CheerioAPI ,  userState: UserStateSubject} {
		const rate = html('input#n_rating').val();
		const tags = this.getTags(html);
		const stateWord = html('div#interest_sect_level > div.a_stars > span.mr10').text().trim();
		const collectionDateStr = html('div#interest_sect_level > div.a_stars > span.mr10').next().text().trim();
		const userState1 = DoubanAbstractLoadHandler.getUserState(stateWord);
		const stateName = this.getBookStateName(stateWord);
		const comment = this.getComment(html);


		const userState: UserStateSubject = {
			tags: tags,
			rate: rate?Number(rate):null,
			state: userState1,
			stateName: stateName,
			collectionDate: collectionDateStr?moment(collectionDateStr, 'YYYY-MM-DD').toDate():null,
			comment: comment
		}
		return {data: html, userState: userState};
	}

	private getTags(html: CheerioAPI): string[] {
		// Tags are no longer adjacent to #rating on current book pages; find the
		// labeled "标签:" text inside the user-state block instead.
		const tagsText = html('#interest_sect_level span.color_gray')
			.get()
			.map(span => html(span).text().trim())
			.find(text => /^标签[:：]/.test(text));
		if (!tagsText) {
			return null;
		}
		const tags = tagsText
			.replace(/^标签[:：]/, '')
			.trim()
			.split(/\s+/)
			.filter(tag => tag);
		return tags.length > 0 ? tags : null;
	}

	private getBookStateName(stateWord: string): string {
		// Keep the internal wish/do/collect enum, but expose book-specific Chinese
		// wording for {{myState}} so it does not depend on the plugin locale.
		if (!stateWord) {
			return '';
		}
		if (stateWord.indexOf('想读') >= 0) {
			return '想读';
		}
		if (stateWord.indexOf('在读') >= 0) {
			return '在读';
		}
		if (stateWord.indexOf('读过') >= 0) {
			return '读过';
		}
		return '';
	}


	parseSubjectFromHtml(html: CheerioAPI, context: HandleContext): DoubanBookSubject {
		// 获取内容简介 - 精确定位"内容简介"部分
		// 豆瓣页面结构：内容简介在 <h2>内容简介</h2> 后面的 <div class="indent"> 中
		// 需要与作者简介区分开
		let desc = '';

		// 方式1: 通过标题定位内容简介部分
		// 查找包含"内容简介"的 h2 标题，然后获取其后面的内容
		const contentIntro = html("h2:contains('内容简介')").parent().find(".indent").first();
		if (contentIntro.length > 0) {
			// 移除 <style> 标签，防止 CSS 内容混入描述文本
			contentIntro.find("style").remove();
			// 检查是否有隐藏的完整内容
			const hiddenContent = contentIntro.find("span.all.hidden").text().trim();
			if (hiddenContent) {
				desc = hiddenContent;
			} else {
				// 获取所有段落内容
				const paragraphs = contentIntro.find("p").get();
				let fullText = '';
				for (const p of paragraphs) {
					const text = html(p).text().trim();
					if (text) {
						fullText += (fullText ? '\n' : '') + text;
					}
				}
				if (fullText) {
					desc = fullText;
				} else {
					// 如果没有 p 标签，直接获取 div 内容
					desc = contentIntro.text().trim();
				}
			}
		}

		// 方式2: 通过 #link-report 定位（内容简介通常在这个区域）
		if (!desc) {
			const linkReport = html("#link-report .intro").first();
			if (linkReport.length > 0) {
				linkReport.find("style").remove();
				const hiddenContent = linkReport.find("span.all.hidden").text().trim();
				if (hiddenContent) {
					desc = hiddenContent;
				} else {
					const paragraphs = linkReport.find("p").get();
					let fullText = '';
					for (const p of paragraphs) {
						const text = html(p).text().trim();
						if (text) {
							fullText += (fullText ? '\n' : '') + text;
						}
					}
					if (fullText) {
						desc = fullText;
					}
				}
			}
		}

		// 方式3: 最后使用 og:description 作为备用
		if (!desc) {
			const metaDesc = html("head > meta[property='og:description']").attr("content");
			if (metaDesc) {
				desc = metaDesc;
			}
		}

		const image = html(html("head > meta[property= 'og:image']").get(0)).attr("content");
		let item = html(html("head > script[type='application/ld+json']").get(0)).text();
		item = super.html_decode(item);
		const obj = JSON.parse(item.replace(/[\r\n\t]+/g, ''));
		const title = obj.name;
		const url = obj.url;
		const author = obj.author.map((a: any) => a.name);
		const isbn = obj.isbn;


		const score = html(html("#interest_sectl > div > div.rating_self.clearfix > strong[property= 'v:average']").get(0)).text();
		const detailDom = html(html("#info").get(0));
		const publish = detailDom.find("span.pl");

		const valueMap = new Map<string, any>();

		publish.map((index, info) => {
			let key = html(info).text().trim();
			let value;
			if (key.indexOf('译者') >= 0) {
				value = [];
				html(info.parent).find("a").map((index, a) => {
					value.push(html(a).text().trim());
				});
			} else if (key.indexOf('作者') >= 0 || key.indexOf('丛书') >= 0 || key.indexOf('出版社') >= 0 || key.indexOf('出品方') >= 0) {
				value = html(info.next.next).text().trim();
			} else {
				value = html(info.next).text().trim();
			}
			let lookupKey = key;
			if (lookupKey.endsWith(':') || lookupKey.endsWith('：')) {
				lookupKey = lookupKey.slice(0, -1);
			}
			valueMap.set(BookKeyValueMap.get(lookupKey), value);
		})
		// 副标题：优先从 #info 的 span.pl 获取，其次从页面的 h2.subtitle 提取
		if (!valueMap.has('subTitle') || !valueMap.get('subTitle')) {
			const subtitleEl = html('h2.subtitle span[property="v:subtitle"]').first();
			if (subtitleEl.length > 0) {
				const sub = subtitleEl.text().trim();
				if (sub) {
					valueMap.set('subTitle', sub);
				}
			}
		}
		let id = StringUtil.analyzeIdByUrl(url);
		let menuIdDom = html('#dir_' + id + '_full') ? html('#dir_' + id + '_full') : html('#dir_' + id + '_short');
		let menu: string[] = menuIdDom ? html(menuIdDom.get(0)).text().trim().split('\n').map(row => row.trim()) : [];
		menu.length > 0 ? menu.pop() : menu;
		const result: DoubanBookSubject = {
			author: author,
			translator: valueMap.has('translator') ? valueMap.get('translator') : [],
			image: image,
			imageUrl: image,
			datePublished: valueMap.has('datePublished') ? new Date(valueMap.get('datePublished')) : undefined,
			isbn: isbn,
			publisher: valueMap.has('publisher') ? valueMap.get('publisher') : "",
			score: Number(score),
			originalTitle: valueMap.has('originalTitle') ? valueMap.get('originalTitle') : "",
			subTitle: valueMap.has('subTitle') ? valueMap.get('subTitle') : "",
			totalPage: valueMap.has('totalPage') ? Number(valueMap.get('totalPage')) : null,
			series: valueMap.has('series') ? valueMap.get('series') : "",
			menu: menu,
			price: valueMap.has('price') ? Number(valueMap.get('price').replace('元', '')) : null,
			id: id,
			type: this.getSupportType(),
			title: title,
			desc: desc,
			url: url,
			genre: [],
			binding: valueMap.has('binding') ? valueMap.get('binding') : "",
			producer: valueMap.has('producer') ? valueMap.get('producer') : "",
		};
		return result;
	}

	private getComment(html: CheerioAPI) {
		// Douban book pages render the user comment as a plain span alongside
		// state/date/tag/rating labels, so filter metadata labels before choosing it.
		let comment = html('#interest_sect_level span')
			.get()
			.map(span => html(span).text().trim())
			.filter(text => this.isCommentCandidate(text))
			.pop();
		if (comment) {
			return comment;
		}
		const fallback = this.getPropertyValue(html, PropertyName.comment);
		return this.isCommentCandidate(fallback) ? fallback : '';
	}

	private isCommentCandidate(text: string): boolean {
		if (!text) {
			return false;
		}
		if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
			return false;
		}
		if (/^标签[:：]/.test(text)) {
			return false;
		}
		if (/^(我的)?评价[:：]?$/.test(text)) {
			return false;
		}
		if (text.indexOf('我读过这本书') >= 0 || text.indexOf('我想读这本书') >= 0 || text.indexOf('我在读这本书') >= 0) {
			return false;
		}
		return true;
	}



}



const BookKeyValueMap: Map<string, string> = new Map(
	[['作者', 'author'],
		['出版社', 'publisher'],
		['原作名', 'originalTitle'],
		['出版年', 'datePublished'],
		['页数', 'totalPage'],
		['定价', 'price'],
		['装帧', 'binding'],
		['丛书', 'series'],
		['ISBN', 'isbn'],
		['译者', 'translator'],
		['副标题', 'subTitle'],
		['出品方', 'producer'],
	]
);