import {DoubanPluginSetting} from "../douban/setting/model/DoubanPluginSetting";
import {PersonNameMode, PictureBedSetting_PicGo, PictureBedType, SupportType} from "./Constsant";
import {DEFAULT_DATA_PROTECTION_SETTINGS} from "../douban/userdata/types";

export const DEFAULT_SETTINGS: DoubanPluginSetting = {
	pictureBedFlag: false,
	pictureBedSetting: PictureBedSetting_PicGo,
	pictureBedType: PictureBedType.PicGo,
	arraySettings: [
		{
			"arrayName": "ArrayType1",
			"arrayStart": "",
			"arrayElementStart": "[[",
			"arraySpiltV2": ",",
			"arrayElementEnd": "]]",
			"arrayEnd": "",
			"index": 1
		}
	],
	onlineSettingsFileName: "obsidian_douban_plugin_online_settings.json",
	onlineSettingsGistId: "35693f9ece9bd6abba98f94e81afde19",
	movieTemplateFile: ``,
	bookTemplateFile: ``,
	musicTemplateFile: ``,
	noteTemplateFile: ``,
	gameTemplateFile: ``,
	teleplayTemplateFile: ``,
	movieTemplateConfig: { source: 'builtin' },
	bookTemplateConfig: { source: 'builtin' },
	musicTemplateConfig: { source: 'builtin' },
	noteTemplateConfig: { source: 'builtin' },
	gameTemplateConfig: { source: 'builtin' },
	teleplayTemplateConfig: { source: 'builtin' },
	searchUrl: 'https://www.douban.com/search?q=',
	dateFormat: "yyyy-MM-DD",
	timeFormat: "HH:mm:ss",
	arrayStart: "",
	arrayElementStart: "\\n  - ",
	arraySpiltV2: "",
	arrayElementEnd: "",
	arrayEnd: "",
	personNameMode: PersonNameMode.CH_NAME,
	dataFilePath: "",
	dataFileNamePath: "/{{type}}/{{title}}",
	statusBar: true,
	debugMode: false,
	customProperties: [
		{name: 'myType', value: 'movie', field: SupportType.movie},
		{name: 'myType', value: 'book', field: SupportType.book},
		{name: 'myType', value: 'music', field: SupportType.music},
		{name: 'myType', value: 'note', field: SupportType.note},
		{name: 'myType', value: 'game', field: SupportType.game},
		{name: 'myType', value: 'teleplay', field: SupportType.teleplay},
		{name: 'myType', value: 'theater', field: SupportType.theater},
	],
	loginCookiesContent: '',
	loginHeadersContent: '',
	cacheImage: true,
	cacheHighQuantityImage: true,
	attachmentPath: 'assets',
	attachmentFileName: "{{title}}",
	syncHandledDataArray: [],
	// syncLastUpdateTime: new Map<string, string>(),
	scoreSetting: {
		starFull: '⭐',
		starEmpty: '☆',
		displayStarEmpty: false,
		maxStar: 5,
	},
	searchDefaultType: SupportType.all,
	templatePresetPaths: {},
	notePathTemplate: '笔记/{{type}}/{{title}}.md',
	noteTemplateContent: `---
doubanId: {{id}}
title: {{title}}
---

# {{title}}

## 记录

## 感想
`,
	dataProtection: DEFAULT_DATA_PROTECTION_SETTINGS,

}


