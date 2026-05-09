import { SyncItemStatus } from "../../../constant/Constsant";

export interface SyncItemResult {
	id: string;
	title: string;
	status: SyncItemStatus;
	/**
	 * 实际生成的文件名（不含扩展名），用于结果文件中的链接
	 */
	fileName?: string;
	/**
	 * 补充说明信息，如类型不匹配时的详情
	 */
	detailMsg?: string;
}
