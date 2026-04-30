import en from './locale/en';
import zhCN from './locale/zh-cn';
import {moment} from 'obsidian';

/**
 * 获取 Obsidian 语言设置
 * [改动] 使用 moment.locale() 替代 localStorage，更可靠地获取 Obsidian 的语言设置
 * 原因: localStorage.getItem('language') 在某些情况下无法正确获取语言设置，
 * 而 Obsidian 会配置 moment 的语言，因此 moment.locale() 更可靠
 */
function getObsidianLocale(): string {
	// 尝试多种方式获取语言设置
	let lang = 'en';

	// 方式1: 从 moment.locale() 获取 (Obsidian 会配置 moment 的语言)
	// 这是最可靠的方式，因为 Obsidian 会根据用户设置配置 moment
	const momentLocale = moment.locale();
	if (momentLocale) {
		lang = momentLocale;
		console.log('[Obsidian-Douban] Detected language from moment.locale():', lang);
	}

	// 方式2: 从 localStorage 获取 (备用)
	if (lang === 'en') {
		const localStorageLang = window.localStorage.getItem('language');
		if (localStorageLang) {
			lang = localStorageLang;
			console.log('[Obsidian-Douban] Detected language from localStorage:', lang);
		}
	}

	// 映射 Obsidian 语言代码到插件支持的语言
	// zh / zh-cn -> zh-cn (简体中文)
	// zh-tw -> zh-cn (暂时使用简体中文)
	// en / en-us -> en (英文)
	// 其他语言默认使用英文
	if (lang === 'zh' || lang === 'zh-cn' || lang === 'zh-CN' ||
		lang === 'zh-tw' || lang === 'zh-TW' || lang.startsWith('zh')) {
		return 'zh-cn';
	}
	return 'en';
}

const localeMap: { [k: string]: Partial<typeof en> } = {
	en,
	'zh-cn': zhCN,
};

const lang = getObsidianLocale();
const locale = localeMap[lang] || localeMap['en'];


export default class I18nHelper {
	public getMessage(str: keyof typeof en | string, ...params: any[]): string {
		if (!locale) {
			console.error('Error: obsidian douban locale not found', lang);
		}
		// @ts-ignore
		let val = (locale && locale[str]) || en[str];
		if (params) {
			for (let i = 0;i < params.length;i++) {
				val = this.replaceAll(i, val, params[i])
			}
		}
		return val;
	}

	private replaceAll(index: number, message: string, replace: string): string {
		const placeholderRegex = new RegExp(`\\{${index}:([^}]+)\\}`);
		const match = message.match(placeholderRegex);
		if (!match) {
			return message.replaceAll(`{${index}}`, replace);
		}
		const defaultValue = match ? match[1] : '';

		// If replace is undefined or null, use the default value
		const replacement = (replace === undefined || replace === null) ? defaultValue : replace;

		// Replace the specific placeholder with the replacement value
		return message.replace(placeholderRegex, replacement);
	}
}

export const i18nHelper: I18nHelper = new I18nHelper();
