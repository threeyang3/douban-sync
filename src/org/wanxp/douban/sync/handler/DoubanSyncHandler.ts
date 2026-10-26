import {CheerioAPI} from "cheerio";
import DoubanSyncSubject from "../model/DoubanSyncSubject";
import {SyncConfig} from "../model/SyncConfig";
import HandleContext from "../../data/model/HandleContext";
import {SyncPreviewResult} from "../model/SyncPreviewResult";

export interface DoubanSyncHandler {

	support(t: string): boolean;

	sync(syncConfig: SyncConfig, context: HandleContext):Promise<void> ;

	preview(syncConfig: SyncConfig, context: HandleContext):Promise<SyncPreviewResult>;

}


