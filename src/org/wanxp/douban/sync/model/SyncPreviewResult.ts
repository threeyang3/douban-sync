export type SyncPreviewAction = 'create' | 'replace' | 'exists' | 'unHandle';

export interface SyncPreviewEntry {
	id: string;
	title: string;
	action: SyncPreviewAction;
	existingFilePath?: string | null;
}

export interface SyncPreviewResult {
	total: number;
	createCount: number;
	replaceCount: number;
	existsCount: number;
	unHandleCount: number;
	affectedCount: number;
	inheritSummary: string[];
	backupEnabled: boolean;
	entries: SyncPreviewEntry[];
}
