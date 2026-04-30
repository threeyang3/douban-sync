import {App, TFile} from "obsidian";
import {SyncConfig} from "./SyncConfig";
import {SyncItemResult} from "./SyncItemResult";
import {
	BasicConst,
	SyncConditionTypeRecords,
	SyncItemStatus,
	SyncTypeRecords
} from "../../../constant/Constsant";
import {SyncHandledData} from "../../setting/model/SyncHandledData";
import {DoubanSubjectStateRecords_SYNC} from "../../../constant/DoubanUserState";

export default class SyncStatusHolder {

	private app: App;

	public handledData: Map<string, Set<string>>;
	public syncResultMap: Map<string, SyncItemResult> = new Map();
	public statusHandleMap: Map<SyncItemStatus, number> = new Map([
	[SyncItemStatus.exists, 0],
	[SyncItemStatus.replace, 0],
	[SyncItemStatus.create, 0],
	[SyncItemStatus.fail, 0],
		[SyncItemStatus.failByDiffType, 0],
		[SyncItemStatus.unHandle, 0],
	]);

	// 缓存已存在的豆瓣ID映射，避免重复遍历
	private existingDoubanIdsCache: Map<string, string> | null = null;

	private key: string;
	//不管处不处理的总数，比如会包含已经存在的，或者条件没覆盖的部分，比如过滤条件选择了1-2条，但总共其实有10条
	private allTotal: number;

	public syncConfig: SyncConfig;
	//处理的总数
	private total:number;
	private handle:number;
	private needHandled:number;
	private message = '';

	constructor(syncConfig: SyncConfig, app: App) {
		this.syncConfig = syncConfig;
		this.app = app;
		this.total = 0;
		this.handle = 0;
		this.needHandled = 0;
		this.key =this.getKey(syncConfig);
	}

	handled(num:number) {
		this.handle = this.handle + num;
	}

	totalNum(num:number) {
		this.total = num ;
	}

	getTotal():number {
		return this.total;
	}

	getHandle():number {
		return this.handle;
	}

	getAllTotal():number {
		return this.allTotal;
	}

	setAllTotal(allTotal:number) {
		this.allTotal = allTotal;
	}



	/**
	 * 已处理总数，包含已经存在不需要同步的部分
	 */
	getHasHandle():number {
		return this.handle;
	}

	setNeedHandled(needHandled:number) {
		this.needHandled = needHandled;
	}

	getNeedHandled():number {
		return this.needHandled;
	}


	public replace(id:string, title:string, fileName?:string) {
		this.putToHandled(id, title);
		this.updateResult(id, title, SyncItemStatus.replace, fileName);
		// 更新缓存，避免后续重复检查
		if (fileName) {
			this.addToExistingCache(id, fileName);
		}
	}

	public exists(id:string, title:string, fileName?:string) {
		this.putToHandled(id, title);
		this.updateResult(id, title, SyncItemStatus.exists, fileName);
	}


	public unHandle(id:string, title:string) {
		this.updateResult(id, title, SyncItemStatus.unHandle);
	}


	public create(id:string, title:string, fileName?:string) {
		this.putToHandled(id, title);
		this.updateResult(id, title, SyncItemStatus.create, fileName);
		// 更新缓存，避免后续重复检查
		if (fileName) {
			this.addToExistingCache(id, fileName);
		}
	}

	public fail(id:string, title:string) {
		this.updateResult(id, title, SyncItemStatus.fail);
	}

	public failByDiffType(id:string, title:string) {
		this.updateResult(id, title, SyncItemStatus.failByDiffType);
	}

	private updateResult(id:string, title:string, status:SyncItemStatus, fileName?:string) {
		this.syncResultMap.set(id, {id: id,title:title,status:status, fileName: fileName});
		this.statusHandleMap.set(status, this.statusHandleMap.get(status) + 1);
		this.handled(1);
	}

	public setTotal(total:number) {
		this.totalNum(total);
	}


	private putToHandled(id: string, title: string) {
		if (!this.handledData) {
			this.handledData = new Map<string, Set<string>>();
		}
		const {key} = this;
		if (!this.handledData.has(key)) {
			this.handledData.set(key, new Set<string>());
		}
		this.handledData.get(key).add(id)
	}

	shouldSync(id: string) {
		return this.handledData.get(this.key)?!this.handledData.get(this.key).has(id):true;
	}

	/**
	 * 构建目标文件夹下已存在文件的豆瓣ID索引
	 * 在同步开始时调用一次，避免每次检查都遍历整个仓库
	 * @param dataFilePath 目标文件夹路径
	 */
	async buildExistingFilesCache(dataFilePath: string): Promise<void> {
		if (!this.app) {
			return;
		}
		this.existingDoubanIdsCache = new Map<string, string>();
		const files: TFile[] = this.app.vault.getMarkdownFiles();
		// 规范化路径，统一使用 / 作为分隔符
		const normalizedPath = this.normalizePath(dataFilePath);

		for (const file of files) {
			// 只检查目标文件夹下的文件
			if (normalizedPath && !this.isInTargetPath(file.path, normalizedPath)) {
				continue;
			}
			try {
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter?.doubanId) {
					const doubanId = String(cache.frontmatter.doubanId).trim();
					if (doubanId) {
						this.existingDoubanIdsCache.set(doubanId, file.path);
					}
				}
			} catch (e) {
				// 忽略单个文件的缓存错误
			}
		}
	}

	/**
	 * 检查本地是否存在指定豆瓣ID的文件
	 * 使用预先构建的缓存，避免重复遍历
	 * @param doubanId 豆瓣ID
	 * @returns 是否存在
	 */
	checkLocalExists(doubanId: string): boolean {
		if (!doubanId?.trim() || !this.existingDoubanIdsCache) {
			return false;
		}
		// 确保 doubanId 是字符串类型并去除前后空格
		const normalizedId = String(doubanId).trim();
		return this.existingDoubanIdsCache.has(normalizedId);
	}

	/**
	 * 规范化路径，统一使用 / 作为分隔符，确保以/结尾
	 */
	private normalizePath(path: string): string {
		if (!path) {
			return '';
		}
		// 统一使用 / 作为路径分隔符
		let normalized = path.replace(/\\/g, '/');
		// 确保以 / 结尾
		if (!normalized.endsWith('/')) {
			normalized += '/';
		}
		return normalized;
	}

	/**
	 * 检查文件是否在目标路径下
	 */
	private isInTargetPath(filePath: string, targetPath: string): boolean {
		if (!targetPath) {
			return true;
		}
		// 统一使用 / 作为路径分隔符
		const normalizedFilePath = filePath.replace(/\\/g, '/');
		// 检查文件路径是否以目标路径开头
		if (normalizedFilePath.startsWith(targetPath)) {
			return true;
		}
		// 也检查不带尾部 / 的情况
		const targetPathWithoutSlash = targetPath.slice(0, -1);
		return normalizedFilePath === targetPathWithoutSlash;
	}

	/**
	 * 添加新创建的文件到缓存中
	 * 用于在同步过程中更新缓存，避免重复检查
	 * @param doubanId 豆瓣ID
	 * @param filePath 文件路径
	 */
	addToExistingCache(doubanId: string, filePath: string): void {
		if (!doubanId?.trim() || !this.existingDoubanIdsCache) {
			return;
		}
		const normalizedId = String(doubanId).trim();
		this.existingDoubanIdsCache.set(normalizedId, filePath);
	}

	/**
	 * 获取指定豆瓣ID对应的现有文件路径
	 * 用于在"替换同名文档"模式下删除旧文件
	 * @param doubanId 豆瓣ID
	 * @returns 文件路径，如果不存在则返回null
	 */
	getExistingFilePath(doubanId: string): string | null {
		if (!doubanId?.trim() || !this.existingDoubanIdsCache) {
			return null;
		}
		const normalizedId = String(doubanId).trim();
		return this.existingDoubanIdsCache.get(normalizedId) || null;
	}

	/**
	 * 从缓存中移除指定豆瓣ID
	 * 用于删除旧文件后更新缓存
	 * @param doubanId 豆瓣ID
	 */
	removeFromExistingCache(doubanId: string): void {
		if (!doubanId?.trim() || !this.existingDoubanIdsCache) {
			return;
		}
		const normalizedId = String(doubanId).trim();
		this.existingDoubanIdsCache.delete(normalizedId);
	}

	getKey(syncConfig: SyncConfig):string {
		const type = syncConfig.syncType ? syncConfig.syncType : '';
		const scope = syncConfig.scope ? syncConfig.scope : '';
		const path = syncConfig.dataFilePath ? syncConfig.dataFilePath : '';
		return `${path}+${type}+${scope}`;
	}

	getOverSize():boolean {
		return this.getNeedHandled() > BasicConst.SLOW_SIZE;
	}

	public initSyncHandledData(data:SyncHandledData[]) {
		this.handledData = new Map<string, Set<string>>();
		const {handledData} = this;
		data.forEach((d) => {
			handledData.set(d.key,new Set<string>(d.value));
		})
		if (!this.syncConfig.incrementalUpdate) {
			this.resetSyncHandledData();
		}
		this.resetTypeOtherSyncHandledData();
	}

	public resetSyncHandledData() {
		return this.handledData.set(this.key, new Set());
	}

	public resetTypeOtherSyncHandledData() {
		this.handledData.forEach((value, key) => {
			if (this.needClearByKey(this.key, key)) {
				value.clear();
			}
		});
	}

	private needClearByKey(handleKey:string, savedKey:string):boolean {
		if (handleKey == savedKey) {
			return false;
		}
		let handledKeys = handleKey.split('+');
		let savedKeys = savedKey.split('+');
		handledKeys = handledKeys??[''];
		savedKeys = savedKeys??[''];
		if (handledKeys[0] == savedKeys[0]) {
			return true;
		}
		return false;
	}

	public setMessage(s: string) {
		this.message = s;
	}

	public getMessage() {
		return this.message;
	}

	public getScopeName():string {
		//@ts-ignore
		return DoubanSubjectStateRecords_SYNC[this.syncConfig.syncType][this.syncConfig.scope];
	}

	public getTypeName():string {
		return SyncTypeRecords[this.syncConfig.syncType];


	}

	public getSyncConditionName() {
		return SyncConditionTypeRecords[this.syncConfig.syncConditionType];
	}
}
