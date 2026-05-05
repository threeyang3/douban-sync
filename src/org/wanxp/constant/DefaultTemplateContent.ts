import {TemplateKey} from "./Constsant";

/**
 * 从 basic 模板生成 sync 模板：
 * - frontmatter 中 `tags:\n  - {{type}}` 替换为用户状态字段
 * - 表格替换为 sync 版本（含状态/标签/评分 Dataview 查询）
 * - 简介 callout 前插入短评 callout
 */
function syncify(basic: string, syncTable: string, basicTable: string): string {
	return basic
		.replace('tags:\n  - {{type}}',
			`myRating: {{myRating}}\nmyRatingStar: {{myRatingStar}}\ntags: {{myTags}}\nstate: {{myState}}\ncollectionDate: {{myCollectionDate}}`)
		.replace(basicTable, syncTable)
		.replace('> [!abstract]- **简介**',
			'> [!abstract]+ **短评**\n> {{myComment}}\n\n> [!abstract]- **简介**');
}

// ==================== Movie ====================

const movieTable = `> | 评分 | {{scoreStar}} |
> | 类型 | {{genre}} |
> | 导演 | {{director}} |
> | 主演 | {{actor}} |
> | 地区 | {{country}} |
> | 语言 | {{language}} |
> | 上映 | {{datePublished}} |
> | 片长 | {{time}} |
> | IMDb | {{IMDb}} |`;

const movieSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 类型 | {{genre}} |
> | 导演 | {{director}} |
> | 主演 | {{actor}} |
> | 地区 | {{country}} |
> | 语言 | {{language}} |
> | 上映 | {{datePublished}} |
> | 片长 | {{time}} |
> | IMDb | {{IMDb}} |`;

const movieBasic = `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
score: {{score}}
scoreStar: {{scoreStar}}
originalTitle: {{originalTitle}}
genre: {{genre}}
datePublished: {{datePublished}}
director: {{director}}
actor: {{actor}}
author: {{author}}
tags:
  - {{type}}
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
> ![cover|300]({{image}})
>
> | | |
> |:------:|:------:|
${movieTable}

> [!abstract]- **简介**
> {{desc}}

## 记录

## 感想
`;

// ==================== Book ====================

const bookTable = `> | 作者 | {{author}} |
> | 译者 | {{translator}} |
> | 评分 | {{scoreStar}} |
> | 出版社 | {{publisher}} |
> | 出版日期 | {{datePublished}} |
> | 页数 | {{totalPage}} |
> | ISBN | {{isbn}} |
> | 丛书 | {{series}} |
> | 装帧 | {{binding}} |
> | 价格 | {{price}} |`;

const bookSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 作者 | {{author}} |
> | 译者 | {{translator}} |
> | 出版社 | {{publisher}} |
> | 出版日期 | {{datePublished}} |
> | 页数 | {{totalPage}} |
> | ISBN | {{isbn}} |
> | 丛书 | {{series}} |
> | 装帧 | {{binding}} |
> | 价格 | {{price}} |`;

const bookBasic = `---
doubanId: {{id}}
title: {{title}}
subTitle: {{subTitle}}
originalTitle: {{originalTitle}}
series: {{series}}
type: {{type}}
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
tags:
  - {{type}}
binding: {{binding}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 📚 **{{title}}**
>
> ![cover|300]({{image}})
>
> | | |
> |:------:|:------:|
${bookTable}

> [!abstract]- **简介**
> {{desc}}

{{menu}}

## 记录

## 感想
`;

// ==================== Music ====================

const musicTable = `> | 表演者 | {{actor}} |
> | 评分 | {{scoreStar}} |
> | 流派 | {{genre}} |
> | 专辑类型 | {{albumType}} |
> | 介质 | {{medium}} |
> | 发行时间 | {{datePublished}} |
> | 出版者 | {{publisher}} |
> | 条形码 | {{barcode}} |
> | 曲目数 | {{records}} |`;

const musicSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 表演者 | {{actor}} |
> | 流派 | {{genre}} |
> | 专辑类型 | {{albumType}} |
> | 介质 | {{medium}} |
> | 发行时间 | {{datePublished}} |
> | 出版者 | {{publisher}} |
> | 条形码 | {{barcode}} |
> | 曲目数 | {{records}} |`;

const musicBasic = `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
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
tags:
  - {{type}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 🎵 **{{title}}**
>
> ![cover|300]({{image}})
>
> | | |
> |:------:|:------:|
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
author: {{author}}
authorUrl: {{authorUrl}}
dateTimePublished: {{datePublished}} {{timePublished}}
url: {{url}}
tags:
  - {{type}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 📝 **{{title}}**
>
> | | |
> |:------:|:------:|
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
> | 类型 | {{genre}} |
> | 平台 | {{platform}} |
> | 开发商 | {{developer}} |
> | 发行商 | {{publisher}} |
> | 发行日期 | {{datePublished}} |`;

const gameSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 类型 | {{genre}} |
> | 平台 | {{platform}} |
> | 开发商 | {{developer}} |
> | 发行商 | {{publisher}} |
> | 发行日期 | {{datePublished}} |`;

const gameBasic = `---
doubanId: {{id}}
title: {{title}}
aliases: {{aliases}}
type: {{type}}
score: {{score}}
scoreStar: {{scoreStar}}
dateTimePublished: {{datePublished}}
publisher: {{publisher}}
genre: {{genre}}
developer: {{developer}}
platform: {{platform}}
url: {{url}}
tags:
  - {{type}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ 🎮 **{{title}}**
>
> ![cover|300]({{image}})
>
> | | |
> |:------:|:------:|
${gameTable}

> [!abstract]- **简介**
> {{desc}}

## 记录

## 感想
`;

// ==================== Teleplay ====================

const teleplayTable = `> | 评分 | {{scoreStar}} |
> | 类型 | {{genre}} |
> | 导演 | {{director}} |
> | 主演 | {{actor}} |
> | 集数 | {{episode}} |
> | 地区 | {{country}} |
> | 语言 | {{language}} |
> | 首播 | {{datePublished}} |
> | 单集片长 | {{time}} |
> | IMDb | {{IMDb}} |`;

const teleplaySyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 豆瓣评分 | {{scoreStar}} |
> | 类型 | {{genre}} |
> | 导演 | {{director}} |
> | 主演 | {{actor}} |
> | 集数 | {{episode}} |
> | 地区 | {{country}} |
> | 语言 | {{language}} |
> | 首播 | {{datePublished}} |
> | 单集片长 | {{time}} |
> | IMDb | {{IMDb}} |`;

const teleplayBasic = `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
score: {{score}}
scoreStar: {{scoreStar}}
originalTitle: {{originalTitle}}
genre: {{genre}}
datePublished: {{datePublished}}
director: {{director}}
actor: {{actor}}
author: {{author}}
tags:
  - {{type}}
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
> ![cover|300]({{image}})
>
> | | |
> |:------:|:------:|
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
