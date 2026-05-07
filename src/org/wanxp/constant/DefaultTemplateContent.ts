import {TemplateKey} from "./Constsant";

/**
 * 从 basic 模板生成 sync 模板：
 * - frontmatter 中 `tags:\n  - {{type}}` 替换为用户状态字段
 * - 表格替换为 sync 版本（含状态/标签/评分 Dataview 查询）
 * - 简介 callout 前插入短评 callout
 */
function syncify(basic: string, syncTable: string, basicTable: string): string {
	return basic
		.replace('createTime:',
			`myRating: {{myRating}}\nmyRatingStar: {{myRatingStar}}\ntags: {{myTags}}\nstate: {{myState}}\ncollectionDate: {{myCollectionDate}}\ncreateTime:`)
		.replace(basicTable, syncTable)
		.replace('> [!abstract]- **简介**',
			'> [!abstract]+ **短评**\n> {{myComment}}\n\n> [!abstract]- **简介**');
}

// ==================== Movie ====================

const movieTable = `> | 评分 | {{scoreStar}} |
> | 类型 | \`= this.genre\` |
> | 导演 | \`= this.director\` |
> | 主演 | \`= this.actor\` |
> | 地区 | \`= this.country\` |
> | 语言 | \`= this.language\` |
> | 上映 | \`= this.datePublished\` |{{#if time}}
> | 片长 | \`= this.time\` |{{/if}}{{#if IMDb}}
> | IMDb | \`= this.IMDb\` |{{/if}}`;

const movieSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 类型 | \`= this.genre\` |
> | 导演 | \`= this.director\` |
> | 主演 | \`= this.actor\` |
> | 地区 | \`= this.country\` |
> | 语言 | \`= this.language\` |
> | 上映 | \`= this.datePublished\` |{{#if time}}
> | 片长 | \`= this.time\` |{{/if}}{{#if IMDb}}
> | IMDb | \`= this.IMDb\` |{{/if}}`;

const movieBasic = `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: "{{image}}"
score: {{score}}
scoreStar: {{scoreStar}}
originalTitle: {{originalTitle}}
genre: {{genre}}
datePublished: {{datePublished}}
director: {{director}}
actor: {{actor}}
author: {{author}}
url: {{url}}
aliases: {{aliases}}
country: {{country}}
language: {{language}}
IMDb: {{IMDb}}
time: {{time}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 🎬 **{{title}}**
>
> ![cover|400]({{image}})
>
> | | |
> |:------:|:------------------------------------------:|
${movieTable}

> [!abstract]- **简介**
> {{desc}}

## 记录

## 感想
`;

// ==================== Book ====================

const bookTable = `> | 作者 | \`= this.author\` |{{#if translator}}
> | 译者 | \`= this.translator\` |{{/if}}
> | 评分 | {{scoreStar}} |
> | 出版社 | \`= this.publisher\` |
> | 出版日期 | \`= this.datePublished\` |{{#if totalPage}}
> | 页数 | \`= this.totalPage\` |{{/if}}
> | ISBN | \`= this.isbn\` |{{#if series}}
> | 丛书 | \`= this.series\` |{{/if}}{{#if binding}}
> | 装帧 | \`= this.binding\` |{{/if}}{{#if price}}
> | 价格 | \`= this.price\` |{{/if}}`;

const bookSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 作者 | \`= this.author\` |{{#if translator}}
> | 译者 | \`= this.translator\` |{{/if}}
> | 出版社 | \`= this.publisher\` |
> | 出版日期 | \`= this.datePublished\` |{{#if totalPage}}
> | 页数 | \`= this.totalPage\` |{{/if}}
> | ISBN | \`= this.isbn\` |{{#if series}}
> | 丛书 | \`= this.series\` |{{/if}}{{#if binding}}
> | 装帧 | \`= this.binding\` |{{/if}}{{#if price}}
> | 价格 | \`= this.price\` |{{/if}}`;

const bookBasic = `---
doubanId: {{id}}
title: {{title}}
subTitle: {{subTitle}}
originalTitle: {{originalTitle}}
series: {{series}}
type: {{type}}
image: "{{image}}"
author: {{author}}
score: {{score}}
scoreStar: {{scoreStar}}
datePublished: {{datePublished}}
translator: {{translator}}
publisher: {{publisher}}
producer: {{producer}}
isbn: {{isbn}}
url: {{url}}
totalPage: {{totalPage}}
price: {{price}}
binding: {{binding}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 📚 **{{title}}**
>
> ![cover|400]({{image}})
>
> | | |
> |:------:|:------------------------------------------:|
${bookTable}

> [!abstract]- **简介**
> {{desc}}

{{menu}}

## 记录

## 感想
`;

// ==================== Music ====================

const musicTable = `> | 表演者 | \`= this.actor\` |
> | 评分 | {{scoreStar}} |
> | 流派 | \`= this.genre\` |{{#if albumType}}
> | 专辑类型 | \`= this.albumType\` |{{/if}}{{#if medium}}
> | 介质 | \`= this.medium\` |{{/if}}
> | 发行时间 | \`= this.datePublished\` |
> | 出版者 | \`= this.publisher\` |{{#if barcode}}
> | 条形码 | \`= this.barcode\` |{{/if}}{{#if records}}
> | 曲目数 | \`= this.records\` |{{/if}}`;

const musicSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 表演者 | \`= this.actor\` |
> | 流派 | \`= this.genre\` |{{#if albumType}}
> | 专辑类型 | \`= this.albumType\` |{{/if}}{{#if medium}}
> | 介质 | \`= this.medium\` |{{/if}}
> | 发行时间 | \`= this.datePublished\` |
> | 出版者 | \`= this.publisher\` |{{#if barcode}}
> | 条形码 | \`= this.barcode\` |{{/if}}{{#if records}}
> | 曲目数 | \`= this.records\` |{{/if}}`;

const musicBasic = `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: "{{image}}"
actor: {{actor}}
score: {{score}}
scoreStar: {{scoreStar}}
genre: {{genre}}
medium: {{medium}}
albumType: {{albumType}}
datePublished: {{datePublished}}
publisher: {{publisher}}
barcode: {{barcode}}
url: {{url}}
records: {{records}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 🎵 **{{title}}**
>
> ![cover|400]({{image}})
>
> | | |
> |:------:|:------------------------------------------:|
${musicTable}

> [!abstract]- **简介**
> {{desc}}

---
Menu:
{{menu}}

## 记录

## 感想
`;

// ==================== Note ====================

const noteBasic = `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: "{{image}}"
author: {{author}}
authorUrl: {{authorUrl}}
dateTimePublished: {{datePublished}} {{timePublished}}
url: {{url}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 📝 **{{title}}**
>
> | | |
> |:------:|:------------------------------------------:|
> | 作者 | {{author}} |
> | 发布时间 | {{datePublished}} {{timePublished}} |

> [!abstract]- **简介**
> {{desc}}

{{content}}

## 记录

## 感想
`;

// ==================== Game ====================

const gameTable = `> | 评分 | {{scoreStar}} |
> | 类型 | \`= this.genre\` |{{#if platform}}
> | 平台 | \`= this.platform\` |{{/if}}{{#if developer}}
> | 开发商 | \`= this.developer\` |{{/if}}
> | 发行商 | \`= this.publisher\` |
> | 发行日期 | \`= this.datePublished\` |`;

const gameSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 类型 | \`= this.genre\` |{{#if platform}}
> | 平台 | \`= this.platform\` |{{/if}}{{#if developer}}
> | 开发商 | \`= this.developer\` |{{/if}}
> | 发行商 | \`= this.publisher\` |
> | 发行日期 | \`= this.datePublished\` |`;

const gameBasic = `---
doubanId: {{id}}
title: {{title}}
aliases: {{aliases}}
type: {{type}}
image: "{{image}}"
score: {{score}}
scoreStar: {{scoreStar}}
dateTimePublished: {{datePublished}}
publisher: {{publisher}}
genre: {{genre}}
developer: {{developer}}
platform: {{platform}}
url: {{url}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 🎮 **{{title}}**
>
> ![cover|400]({{image}})
>
> | | |
> |:------:|:------------------------------------------:|
${gameTable}

> [!abstract]- **简介**
> {{desc}}

## 记录

## 感想
`;

// ==================== Teleplay ====================

const teleplayTable = `> | 评分 | {{scoreStar}} |
> | 类型 | \`= this.genre\` |
> | 导演 | \`= this.director\` |
> | 主演 | \`= this.actor\` |{{#if episode}}
> | 集数 | \`= this.episode\` |{{/if}}
> | 地区 | \`= this.country\` |
> | 语言 | \`= this.language\` |
> | 首播 | \`= this.datePublished\` |{{#if time}}
> | 单集片长 | \`= this.time\` |{{/if}}{{#if IMDb}}
> | IMDb | \`= this.IMDb\` |{{/if}}`;

const teleplaySyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 类型 | \`= this.genre\` |
> | 导演 | \`= this.director\` |
> | 主演 | \`= this.actor\` |{{#if episode}}
> | 集数 | \`= this.episode\` |{{/if}}
> | 地区 | \`= this.country\` |
> | 语言 | \`= this.language\` |
> | 首播 | \`= this.datePublished\` |{{#if time}}
> | 单集片长 | \`= this.time\` |{{/if}}{{#if IMDb}}
> | IMDb | \`= this.IMDb\` |{{/if}}`;

const teleplayBasic = `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: "{{image}}"
score: {{score}}
scoreStar: {{scoreStar}}
originalTitle: {{originalTitle}}
genre: {{genre}}
datePublished: {{datePublished}}
director: {{director}}
actor: {{actor}}
author: {{author}}
url: {{url}}
aliases: {{aliases}}
country: {{country}}
language: {{language}}
IMDb: {{IMDb}}
time: {{time}}
episode: {{episode}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 📺 **{{title}}**
>
> ![cover|400]({{image}})
>
> | | |
> |:------:|:------------------------------------------:|
${teleplayTable}

> [!abstract]- **简介**
> {{desc}}

## 记录

## 感想
`;

// ==================== Exports ====================

export const DEFAULT_TEMPLATE_CONTENT: Record<string, string> = {
	movieTemplateFileContent: movieBasic,
	bookTemplateFileContent: bookBasic,
	musicTemplateFileContent: musicBasic,
	noteTemplateFileContent: noteBasic,
	gameTemplateFileContent: gameBasic,
	teleplayTemplateFileContent: teleplayBasic,
};

export const DEFAULT_TEMPLATE_CONTENT_WITH_STATE: Record<string, string> = {
	movieTemplateFileContent: syncify(movieBasic, movieSyncTable, movieTable),
	bookTemplateFileContent: syncify(bookBasic, bookSyncTable, bookTable),
	musicTemplateFileContent: syncify(musicBasic, musicSyncTable, musicTable),
	noteTemplateFileContent: noteBasic,
	gameTemplateFileContent: syncify(gameBasic, gameSyncTable, gameTable),
	teleplayTemplateFileContent: syncify(teleplayBasic, teleplaySyncTable, teleplayTable),
};

/**
 * 获取默认的文档内容
 * @param key
 */
export function getDefaultTemplateContent(key: TemplateKey, useStateTemplate: boolean = true): string {
	const source = useStateTemplate ? DEFAULT_TEMPLATE_CONTENT_WITH_STATE : DEFAULT_TEMPLATE_CONTENT;
	return source[key + 'Content'] ?? '';
}
