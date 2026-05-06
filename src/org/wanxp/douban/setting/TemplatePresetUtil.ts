import { normalizePath } from "obsidian";
import { TemplateKey } from "../../constant/Constsant";
import {
	DEFAULT_TEMPLATE_CONTENT,
	DEFAULT_TEMPLATE_CONTENT_WITH_STATE,
} from "../../constant/DefaultTemplateContent";

export type BuiltInTemplatePresetType = 'basic' | 'compact' | 'sync';

export const BUILT_IN_TEMPLATE_PRESET_RECORDS: Record<BuiltInTemplatePresetType, string> = {
	basic: '121912',
	compact: '121913',
	sync: '121914',
};

export function getBuiltInTemplatePresetContent(key: TemplateKey, preset: BuiltInTemplatePresetType): string {
	switch (preset) {
		case 'basic':
			return DEFAULT_TEMPLATE_CONTENT[key + 'Content'] ?? '';
		case 'sync':
			return DEFAULT_TEMPLATE_CONTENT_WITH_STATE[key + 'Content'] ?? '';
		case 'compact':
			return getCompactTemplateContent(key);
	}
}

export function getBuiltInTemplateDefaultPath(key: TemplateKey, preset: BuiltInTemplatePresetType): string {
	return normalizePath(`Templates/Obsidian-Douban/${key}-${preset}.md`);
}

function getCompactTemplateContent(key: TemplateKey): string {
	switch (key) {
		case TemplateKey.movieTemplateFile:
		case TemplateKey.teleplayTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: {{imageData.url}}
score: {{score}}
datePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
aliases: {{aliases}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ **{{title}}**
>
> | | |
> |:------:|:------:|
> | 状态 | \`= this.state\` |
> | 评分 | {{score}} |
> | 日期 | {{datePublished}} |

> [!abstract]- **简介**
> {{desc}}

{{myComment}}`;
		case TemplateKey.bookTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: {{imageData.url}}
author: {{author}}
score: {{score}}
datePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ **{{title}}**
>
> | | |
> |:------:|:------:|
> | 作者 | {{author}} |
> | 状态 | \`= this.state\` |
> | 评分 | {{score}} |
> | 日期 | {{datePublished}} |

> [!abstract]- **简介**
> {{desc}}

{{myComment}}`;
		case TemplateKey.musicTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: {{imageData.url}}
actor: {{actor}}
score: {{score}}
datePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ **{{title}}**
>
> | | |
> |:------:|:------:|
> | 表演者 | {{actor}} |
> | 状态 | \`= this.state\` |
> | 评分 | {{score}} |
> | 日期 | {{datePublished}} |

> [!abstract]- **简介**
> {{desc}}

{{myComment}}`;
		case TemplateKey.noteTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: {{imageData.url}}
author: {{author}}
dateTimePublished: {{datePublished}} {{timePublished}}
url: {{url}}
tags: {{myTags}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ **{{title}}**
>
> | | |
> |:------:|:------:|
> | 作者 | {{author}} |
> | 发布 | {{datePublished}} |

{{content}}`;
		case TemplateKey.gameTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
image: {{imageData.url}}
score: {{score}}
platform: {{platform}}
dateTimePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
aliases: {{aliases}}
createTime: {{currentDate}} {{currentTime}}
---

> [!douban-info]+ **{{title}}**
>
> | | |
> |:------:|:------:|
> | 状态 | \`= this.state\` |
> | 评分 | {{score}} |
> | 平台 | {{platform}} |
> | 日期 | {{datePublished}} |

> [!abstract]- **简介**
> {{desc}}

{{myComment}}`;
	}
}
