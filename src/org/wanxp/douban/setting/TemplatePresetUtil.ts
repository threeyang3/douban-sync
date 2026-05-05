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
			// @ts-ignore
			return DEFAULT_TEMPLATE_CONTENT[key + "Content"];
		case 'sync':
			// @ts-ignore
			return DEFAULT_TEMPLATE_CONTENT_WITH_STATE[key + "Content"];
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
score: {{score}}
datePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
aliases: {{aliases}}
desc: {{desc}}
---

![image]({{image}})

{{myComment}}`;
		case TemplateKey.bookTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
author: {{author}}
score: {{score}}
datePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
desc: {{desc}}
---

![image]({{image}})

{{myComment}}`;
		case TemplateKey.musicTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
actor: {{actor}}
score: {{score}}
datePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
desc: {{desc}}
---

![image]({{image}})

{{myComment}}`;
		case TemplateKey.noteTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
author: {{author}}
dateTimePublished: {{datePublished}} {{timePublished}}
url: {{url}}
tags:
  - {{type}}
desc: {{desc}}
---

{{content}}`;
		case TemplateKey.gameTemplateFile:
			return `---
doubanId: {{id}}
title: {{title}}
type: {{type}}
score: {{score}}
platform: {{platform}}
dateTimePublished: {{datePublished}}
tags: {{myTags}}
state: {{myState}}
url: {{url}}
aliases: {{aliases}}
desc: {{desc}}
---

![image]({{image}})

{{myComment}}`;
	}
}
