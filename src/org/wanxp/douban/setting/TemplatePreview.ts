import {parseYaml} from 'obsidian';
import {Action, SearchHandleMode, SupportType, TemplateKey} from '../../constant/Constsant';
import {DoubanSubjectState} from '../../constant/DoubanUserState';
import DoubanPlugin from '../../main';
import SettingsManager from './SettingsManager';
import DoubanSubject from '../data/model/DoubanSubject';
import DoubanMovieLoadHandler from '../data/handler/DoubanMovieLoadHandler';
import DoubanBookLoadHandler from '../data/handler/DoubanBookLoadHandler';
import DoubanMusicLoadHandler from '../data/handler/DoubanMusicLoadHandler';
import DoubanGameLoadHandler from '../data/handler/DoubanGameLoadHandler';
import DoubanNoteLoadHandler from '../data/handler/DoubanNoteLoadHandler';
import {DoubanTeleplayLoadHandler} from '../data/handler/DoubanTeleplayLoadHandler';
import DoubanTheaterLoadHandler from '../data/handler/DoubanTheaterLoadHandler';

export interface TemplatePreviewDocument {
	markdown: string;
	properties: Record<string, unknown>;
	unresolved: string[];
	yamlError?: string;
}

const PREVIEW_TYPES = {
	[TemplateKey.movieTemplateFile]: [SupportType.movie, '星海之间', DoubanMovieLoadHandler],
	[TemplateKey.bookTemplateFile]: [SupportType.book, '慢读时光', DoubanBookLoadHandler],
	[TemplateKey.musicTemplateFile]: [SupportType.music, '午后回声', DoubanMusicLoadHandler],
	[TemplateKey.noteTemplateFile]: [SupportType.note, '一个晴朗的下午', DoubanNoteLoadHandler],
	[TemplateKey.gameTemplateFile]: [SupportType.game, '远方来信', DoubanGameLoadHandler],
	[TemplateKey.teleplayTemplateFile]: [SupportType.teleplay, '城里的故事', DoubanTeleplayLoadHandler],
	[TemplateKey.theaterTemplateFile]: [SupportType.theater, '月光剧场', DoubanTheaterLoadHandler],
} as const;

function sampleCover(): string {
	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">'
		+ '<rect width="300" height="420" fill="#173d40"/><circle cx="220" cy="110" r="92" fill="#d8ba7d"/>'
		+ '<path d="M0 320L160 130L300 300V420H0Z" fill="#426b65"/><path d="M0 360L155 220L300 360V420H0Z" fill="#87a99a"/>'
		+ '<text x="26" y="48" fill="#f3ebd8" font-family="serif" font-size="16" letter-spacing="4">DOUBAN</text>'
		+ '<text x="26" y="388" fill="#173d40" font-family="serif" font-size="14" letter-spacing="3">SAMPLE / 01</text></svg>';
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Use the import formatter with an isolated settings copy; never fetch or save a note. */
export async function renderTemplatePreview(
	content: string,
	templateKey: TemplateKey,
	manager: SettingsManager,
): Promise<TemplatePreviewDocument> {
	if (!content.trim()) return prepareTemplatePreview('');
	const [type, title, Handler] = PREVIEW_TYPES[templateKey];
	const settings = JSON.parse(JSON.stringify(manager.settings));
	settings.cacheImage = false;
	const configKey = templateKey.replace('File', 'Config');
	settings[configKey] = {source: 'custom', customContent: content};
	const previewPlugin = {
		app: manager.app, settings, userComponent: {isLogin: () => true},
	} as unknown as DoubanPlugin;
	previewPlugin.settingsManager = new SettingsManager(manager.app, previewPlugin);
	const person = (name: string) => type === SupportType.book || type === SupportType.music || type === SupportType.note ? name : {name};
	const subject = {
		id: '1234567', title, type, originalTitle: 'A Quiet Journey', score: 8.6,
		image: 'douban-preview-cover.svg', imageUrl: '', url: 'https://www.douban.com/',
		desc: '这是一段用于预览的示例简介。文字、封面和条目信息会随着模板排版呈现。\n在这里调整栏目、引用和标题，找到适合自己的阅读方式。',
		publisher: '示例出版社', datePublished: new Date(2024, 4, 20), genre: ['剧情', '生活'],
		author: [person('林间')], director: [{name: '陈默'}], actor: [person('周宁'), person('许夏')],
		translator: ['李青'], aliases: ['安静的旅程'], country: ['中国'], language: ['汉语普通话'],
		time: '118分钟', IMDb: 'tt1234567', subTitle: '把日子过成一首诗', series: '生活书架',
		isbn: '9780000000000', totalPage: 256, price: 48, binding: '精装', producer: '示例文化',
		menu: ['序言', '第一章 · 启程', '第二章 · 归来'], popularComments: ['温柔而有力量的作品。'],
		platform: ['PC', 'Switch'], developer: ['示例工作室'], medium: 'CD', albumType: '专辑', records: '1', barcode: '123456789',
		episode: 12, authorUrl: 'https://www.douban.com/', content: '## 日常片刻\n\n在普通的一天里，记录值得记住的小事。',
		userState: {tags: ['值得重温', '收藏'], rate: 4, state: DoubanSubjectState.collect,
			stateName: type === SupportType.book ? '读过' : '已完成', comment: '留一点时间，慢慢体会。', collectionDate: new Date(2024, 5, 1)},
	} as unknown as DoubanSubject;
	subject.imageUrl = subject.image;
	const handler = new Handler(previewPlugin);
	const result = await handler.parse(subject as never, {
		plugin: previewPlugin, settings, userComponent: previewPlugin.userComponent,
		netFileHandler: manager.plugin.netFileHandler, action: Action.SearchAndReplace,
		mode: SearchHandleMode.FOR_REPLACE, showAfterCreate: false,
	});
	return prepareTemplatePreview(result.content);
}

/** Render simple inline field references without invoking Dataview or executable blocks. */
export function prepareTemplatePreview(content: string): TemplatePreviewDocument {
	let markdown = content;
	let properties: Record<string, unknown> = {};
	let yamlError: string;
	const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (frontmatter) {
		markdown = content.slice(frontmatter[0].length);
		try {
			const value = parseYaml(frontmatter[1]);
			if (value != null && (typeof value !== 'object' || Array.isArray(value))) throw new Error('Expected a property map');
			properties = value || {};
		} catch (error) {
			yamlError = error instanceof Error ? error.message : String(error);
		}
	} else if (/^---\r?\n/.test(content)) {
		yamlError = 'Missing closing ---';
	}
	markdown = markdown.replace(/`=\s*this\.([\w\u4e00-\u9fff-]+)\s*`/g, (_match, key: string) => {
		const value = properties[key];
		return (Array.isArray(value) ? value.join('、') : value == null || value === '' ? '—' : String(value)).replace(/\|/g, '\\|');
	});
	// A word joiner keeps unsupported inline queries visible as code, without executing them.
	markdown = markdown.replace(/`(?=\$?=)/g, '`\u2060');
	markdown = markdown.replace(/^(\s*(?:>\s*)*)(`{3,}|~{3,})\s*(?:dataviewjs|dataview|js-engine|templater)\b[^\r\n]*/gim, '$1$2text');
	markdown = markdown.replace(/\]\(douban-preview-cover\.svg\)/g, `](${sampleCover()})`)
		.replace(/!\[\[douban-preview-cover\.svg(?:\|[^\]]*)?\]\]/g, `![cover](${sampleCover()})`);
	return {markdown, properties, yamlError, unresolved: Array.from(new Set(content.match(/\{\{[^}\r\n]+\}\}/g) || []))};
}
