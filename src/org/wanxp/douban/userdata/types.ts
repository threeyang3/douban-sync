import { TFile } from 'obsidian';

/**
 * 用户数据保护功能类型定义
 *
 * 导出/导入/继承统一保留三部分：
 * - identifier: 用于识别条目的属性
 * - customProperties: 所有本地自定义属性
 * - bodySections: 正文中的记录/感想两部分
 */

export const DOUBAN_FIELDS = new Set([
	// 基础字段
	'doubanId', 'title', 'type', 'score', 'image', 'imageUrl', 'url', 'desc',
	'publisher', 'datePublished', 'genre',
	// 用户状态字段
	'tags', 'rate', 'state', 'collectionDate', 'comment',
	'myRating', 'myRatingStar', 'myState', 'myComment', 'myTags', 'myCollectionDate',
	// 书籍
	'author', 'translator', 'isbn', 'originalTitle', 'subTitle',
	'totalPage', 'series', 'menu', 'price', 'binding', 'producer',
	// 电影/电视
	'director', 'actor', 'aggregateRating', 'aliases',
	'country', 'language', 'time', 'IMDb',
	// 音乐
	'albumType', 'medium', 'records', 'barcode',
	// 游戏
	'platform', 'developer',
	// 电视
	'episode',
	// 日记
	'authorUrl', 'content',
	// 系统字段
	'createTime', 'doubanSyncSnapshot',
]);

export interface DoubanUserData {
	identifier: {
		doubanId: string;
		title: string;
		type: string;
	};
	customProperties?: Record<string, unknown>;
	bodySections?: {
		record?: string;
		thoughts?: string;
	};
}

export interface UserDataExport {
	version: string;
	exportTime: string;
	subjectType: string;
	totalCount: number;
	items: Record<string, DoubanUserData>;
}

export type MergeStrategy = 'prefer_local' | 'prefer_import' | 'smart';

export interface ImportOptions {
	mergeStrategy: MergeStrategy;
}

export interface ImportResult {
	success: number;
	skipped: number;
	errors: Array<{ doubanId: string; title: string; error: string }>;
	missingFields: MissingFieldDecision[];
}

export interface MissingFieldDecision {
	doubanId: string;
	title: string;
	fieldName: string;
	fieldValue: unknown;
	decision: 'add' | 'skip' | null;
}

export type FieldStrategy = 'keep_local' | 'overwrite' | 'smart_merge';

export interface FieldDiff {
	fieldName: string;
	localValue: unknown;
	importValue: unknown;
	strategy: FieldStrategy;
}

export interface EntryDiff {
	doubanId: string;
	title: string;
	type: string;
	localFile: TFile | null;
	fieldDiffs: FieldDiff[];
	identical: boolean;
}

export interface DataProtectionSettings {
	preserveCustomProperties: boolean;
	preserveRecord: boolean;
	preserveThoughts: boolean;
}

export const DEFAULT_DATA_PROTECTION_SETTINGS: DataProtectionSettings = {
	preserveCustomProperties: true,
	preserveRecord: true,
	preserveThoughts: true,
};
