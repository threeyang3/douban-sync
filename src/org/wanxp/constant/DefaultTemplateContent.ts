import {TemplateKey} from "./Constsant";

function syncify(basic: string, syncTable: string, basicTable: string): string {
	return basic
		.replace('createTime:',
			`state: {{myState}}\ntags: {{myTags}}\nmyRatingStar: {{myRatingStar}}\n短评: {{myComment}}\n标语: \n单评: false\n笔记: ""\n存储: \n相关: \ncollectionDate: {{myCollectionDate}}\ncoverUrl: {{imageData.url}}\ncreateTime:`)
		.replace(basicTable, syncTable)
		.replace('> [!abstract]- **简介**',
			'> [!abstract]+ **短评**\n> {{myComment}}\n\n> [!abstract]- **简介**');
}

// ==================== Movie ====================

const movieTable = `> | 年份 | {{yearPublished}} |
> | 类型 | \`= this.genre\` |
> | 导演 | \`= this.director\` |
> | 语言 | \`= this.language\` |`;

const movieSyncTable = `> | 标语 | \`= this.标语\` |
> | 状态 | \`= this.state\` |
> | 类型 | \`= this.genre\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 短评 | \`= this.短评\` |
> | 导演 | \`= this.director\` |
> | 语言 | \`= this.language\` |
> | 存储 | \`= this.存储\` |
> | 相关 | \`= this.相关\` |
> | 年份 | {{yearPublished}} |`;

const movieBasic = `---
title: {{title}}
originalTitle: {{originalTitle}}
type: {{type}}
genre: {{genre}}
country: {{country}}
score: {{score}}
aliases: {{aliases}}
director: "[[{{director}}]]"
actor: {{actor}}
author: {{author}}
datePublished: {{datePublished}}
language: {{language}}
time: {{time}}
doubanId: {{id}}
IMDb: {{IMDb}}
url: {{url}}
image: {{image}}
createTime: {{currentDate}}
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

const bookTable = `> | 作者 | \`= this.author\` |
> | 出版发行 | {{publisher}} |
> | 出版年份 | {{yearPublished}} |`;

const bookSyncTable = `> | 标语 | \`= this.标语\` |
> | 作者 | \`= this.author\` |
> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 短评 | \`= this.短评\` |
> | 位置 | \`= this.位置\` |
> | 相关 | \`= this.相关\` |
> | 出版发行 | {{publisher}} |
> | 出版年份 | {{yearPublished}} |`;

const bookBasic = `---
title: {{title}}
subTitle: {{subTitle}}
originalTitle: {{originalTitle}}
series: {{series}}
type: {{type}}
author: {{author}}
translator: {{translator}}
score: {{score}}
datePublished: {{datePublished}}
publisher: {{publisher}}
producer: {{producer}}
doubanId: {{id}}
isbn: {{isbn}}
url: {{url}}
totalPage: {{totalPage}}
price: {{price}}
binding: {{binding}}
image: {{image}}
拥有: false
位置: ""
createTime: {{currentDate}}
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

> [!abstract]- **目录**
> {{menu}}

## 记录

## 感想
`;

// ==================== Music ====================

const musicTable = `> | 表演者 | \`= this.actor\` |
> | 流派 | \`= this.genre\` |
> | 发行时间 | \`= this.datePublished\` |
> | 出版者 | \`= this.publisher\` |`;

const musicSyncTable = `> | 状态 | \`= this.state\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 短评 | \`= this.短评\` |
> | 表演者 | \`= this.actor\` |
> | 流派 | \`= this.genre\` |
> | 发行时间 | \`= this.datePublished\` |
> | 出版者 | \`= this.publisher\` |`;

const musicBasic = `---
title: {{title}}
type: {{type}}
actor: {{actor}}
score: {{score}}
genre: {{genre}}
medium: {{medium}}
albumType: {{albumType}}
datePublished: {{datePublished}}
publisher: {{publisher}}
barcode: {{barcode}}
doubanId: {{id}}
url: {{url}}
image: {{image}}
createTime: {{currentDate}}
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

> [!abstract]- **曲目列表**
> {{menu}}

## 记录

## 感想
`;

// ==================== Note ====================

const noteBasic = `---
title: {{title}}
type: {{type}}
author: {{author}}
authorUrl: {{authorUrl}}
dateTimePublished: {{datePublished}} {{timePublished}}
doubanId: {{id}}
url: {{url}}
image: {{image}}
createTime: {{currentDate}}
---

> [!douban-info]+ 📝 **{{title}}**
>
> | | |
> |:------:|:------------------------------------------:|
> | 作者 | \`= this.author\` |
> | 发布时间 | \`= this.dateTimePublished\` |

{{content}}
`;

// ==================== Game ====================

const gameTable = `> | 类型 | \`= this.genre\` |
> | 平台 | \`= this.platform\` |
> | 开发商 | \`= this.developer\` |
> | 发行商 | {{publisher}} |
> | 发行年份 | {{yearPublished}} |`;

const gameSyncTable = `> | 标语 | \`= this.标语\` |
> | 状态 | \`= this.state\` |
> | 类型 | \`= this.genre\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 短评 | \`= this.短评\` |
> | 开发商 | \`= this.developer\` |
> | 发行商 | {{publisher}} |
> | 相关 | \`= this.相关\` |
> | 存储 | \`= this.存储\` |
> | 发行年份 | {{yearPublished}} |`;

const gameBasic = `---
title: {{title}}
type: {{type}}
genre: {{genre}}
platform: {{platform}}
country: {{country}}
score: {{score}}
aliases: {{aliases}}
dateTimePublished: {{datePublished}}
publisher: {{publisher}}
developer: {{developer}}
doubanId: {{id}}
url: {{url}}
image: {{image}}
createTime: {{currentDate}}
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

const teleplayTable = `> | 年份 | {{yearPublished}} |
> | 类型 | \`= this.genre\` |
> | 导演 | \`= this.director\` |
> | 语言 | \`= this.language\` |
> | 集数 | {{episode}} |`;

const teleplaySyncTable = `> | 标语 | \`= this.标语\` |
> | 状态 | \`= this.state\` |
> | 类型 | \`= this.genre\` |
> | 标签 | \`= this.tags\` |
> | 评分 | \`= this.myRatingStar\` |
> | 短评 | \`= this.短评\` |
> | 导演 | \`= this.director\` |
> | 语言 | \`= this.language\` |
> | 存储 | \`= this.存储\` |
> | 相关 | \`= this.相关\` |
> | 年份 | {{yearPublished}} |
> | 集数 | {{episode}} |`;

const teleplayBasic = `---
title: {{title}}
originalTitle: {{originalTitle}}
type: {{type}}
genre: {{genre}}
country: {{country}}
score: {{score}}
aliases: {{aliases}}
datePublished: {{datePublished}}
episode: {{episode}}
director: "[[{{director}}]]"
actor: {{actor}}
author: {{author}}
language: {{language}}
time: {{time}}
doubanId: {{id}}
IMDb: {{IMDb}}
url: {{url}}
image: {{image}}
createTime: {{currentDate}}
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

export function getDefaultTemplateContent(key: TemplateKey, useStateTemplate: boolean = true): string {
	const source = useStateTemplate ? DEFAULT_TEMPLATE_CONTENT_WITH_STATE : DEFAULT_TEMPLATE_CONTENT;
	return source[key + 'Content'] ?? '';
}
