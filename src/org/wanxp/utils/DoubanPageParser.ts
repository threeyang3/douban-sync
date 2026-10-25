import {CheerioAPI, load} from "cheerio";
import {AnyNode} from "domhandler";

/**
 * Semantic DOM helpers shared by Douban subject handlers.
 *
 * Douban changes wrapper elements and sibling order frequently. These helpers
 * prefer labels, field names and stable content containers over positional
 * chains such as next().next().
 */
export default class DoubanPageParser {
	private static readonly USER_SCOPES = [
		'#interest_sect_level',
		'.collection-section',
		'#interest_section',
	];

	static normalizeText(value: string): string {
		if (!value) {
			return '';
		}
		const lines = String(value)
			.replace(/\r\n?/g, '\n')
			.split('\n')
			.map(line => line.replace(/[\t\f\v ]+/g, ' ').trim())
		const compact: string[] = [];
		lines.forEach(line => {
			if (line || (compact.length > 0 && compact[compact.length - 1] !== '')) {
				compact.push(line);
			}
		});
		while (compact.length > 0 && compact[compact.length - 1] === '') {
			compact.pop();
		}
		return compact.join('\n').trim();
	}

	static extractText(html: CheerioAPI, selectors: string[]): string {
		for (const selector of selectors) {
			const values = html(selector)
				.get()
				.map(element => this.extractElementText(html, element))
				.filter(Boolean);
			const uniqueValues = Array.from(new Set(values));
			if (uniqueValues.length > 0) {
				return uniqueValues.join('\n\n');
			}
		}
		return '';
	}

	static extractLongestText(html: CheerioAPI, selectors: string[]): string {
		let longest = '';
		for (const selector of selectors) {
			html(selector).each((_index, element) => {
				const value = this.extractElementText(html, element);
				if (value.length > longest.length) {
					longest = value;
				}
			});
		}
		return longest;
	}

	static parseUserTags(html: CheerioAPI): string[] {
		const labeled = this.findLabeledElement(html, /^标签\s*[:：]/);
		if (!labeled) {
			return null;
		}
		let text = this.normalizeText(html(labeled).text())
			.replace(/^标签\s*[:：]\s*/, '');
		if (!text && labeled.parent) {
			text = this.normalizeText(html(labeled.parent as AnyNode).text())
				.replace(/^标签\s*[:：]\s*/, '');
		}
		const tags = text.split(/\s+/).map(tag => tag.trim()).filter(Boolean);
		return tags.length > 0 ? tags : null;
	}

	static parseUserComment(html: CheerioAPI, fallbackSelectors: string[] = []): string {
		const tags = this.parseUserTags(html);
		const explicit = this.extractText(html, [
			...this.USER_SCOPES.flatMap(scope => [
				`${scope} textarea[name='comment']`,
				`${scope} [data-field='comment']`,
				`${scope} .comment-text`,
				`${scope} .comment-content`,
			]),
			...fallbackSelectors,
		]);
		if (explicit && this.isCommentCandidate(explicit) && !this.isTagValueCandidate(explicit, tags)) {
			return explicit;
		}

		const tagElement = this.findLabeledElement(html, /^标签\s*[:：]/);
		if (tagElement) {
			let sibling = tagElement.nextSibling;
			while (sibling) {
				const candidate = this.normalizeText(html(sibling as AnyNode).text());
				if (this.isCommentCandidate(candidate) && !this.isTagValueCandidate(candidate, tags)) {
					return candidate;
				}
				sibling = sibling.nextSibling;
			}
		}

		// Older pages only expose the comment as an unlabeled leaf next to state
		// and rating metadata. Prefer the final valid leaf within the user scope.
		const candidates: string[] = [];
		for (const scope of this.USER_SCOPES) {
			html(`${scope} span, ${scope} p, ${scope} div`).each((_index, element) => {
				if (html(element).children().length > 0) {
					return;
				}
				const candidate = this.normalizeText(html(element).text());
				if (this.isCommentCandidate(candidate) && !this.isTagValueCandidate(candidate, tags)) {
					candidates.push(candidate);
				}
			});
			if (candidates.length > 0) {
				break;
			}
		}
		return candidates.length > 0 ? candidates[candidates.length - 1] : '';
	}

	static collectFollowingFieldText(html: CheerioAPI, labelElement: AnyNode): string {
		const values: string[] = [];
		let sibling = labelElement.nextSibling;
		while (sibling) {
			if (sibling.type === 'tag' && sibling.name === 'br') {
				break;
			}
			const value = this.normalizeText(html(sibling as AnyNode).text());
			if (value && !/^[\/、,，;；]+$/.test(value)) {
				values.push(value);
			}
			sibling = sibling.nextSibling;
		}
		return Array.from(new Set(values)).join(' / ');
	}

	private static extractElementText(html: CheerioAPI, element: AnyNode): string {
		const fragment = html(element).html();
		const value = fragment == null
			? html(element).text()
			: load(`<div>${fragment.replace(/<br\s*\/?\s*>/gi, '\n')}</div>`)('div').text();
		return this.normalizeText(value);
	}

	private static findLabeledElement(html: CheerioAPI, label: RegExp): AnyNode | null {
		for (const scope of this.USER_SCOPES) {
			const matching = html(`${scope} span, ${scope} div, ${scope} p`)
				.get()
				.map(element => ({element, text: this.normalizeText(html(element).text())}))
				.filter(item => label.test(item.text))
				.sort((a, b) => a.text.length - b.text.length);
			if (matching.length > 0) {
				return matching[0].element;
			}
		}
		return null;
	}

	private static isCommentCandidate(text: string): boolean {
		if (!text || text.length < 2) {
			return false;
		}
		if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text) || /^\d+(?:\.\d+)?$/.test(text)) {
			return false;
		}
		if (/^标签\s*[:：]/.test(text) || /^(我的)?评价\s*[:：]?$/.test(text)) {
			return false;
		}
		if (/^(想看|看过|在看|想读|读过|在读|想听|听过|在听|想玩|玩过|在玩)/.test(text)) {
			return false;
		}
		if (/^(修改|删除|评分|暂无评价)$/.test(text)) {
			return false;
		}
		if (/^[一二三四五1-5]星$/.test(text) || /^(很差|较差|还行|推荐|力荐)$/.test(text)) {
			return false;
		}
		return true;
	}

	private static isTagValueCandidate(text: string, tags: string[]): boolean {
		if (!text || !tags || tags.length === 0) {
			return false;
		}
		const tokens = text.split(/\s+/).filter(Boolean);
		return tokens.length > 0 && tokens.every(token => tags.includes(token));
	}
}
