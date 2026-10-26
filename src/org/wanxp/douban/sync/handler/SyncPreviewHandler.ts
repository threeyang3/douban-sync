import DoubanPlugin from "../../../main";
import {App} from "obsidian";
import {SyncConfig} from "../model/SyncConfig";
import HandleContext from "../../data/model/HandleContext";
import {DoubanSyncHandler} from "./DoubanSyncHandler";
import {DoubanMovieSyncHandler} from "./DoubanMovieSyncHandler";
import {DoubanBookSyncHandler} from "./DoubanBookSyncHandler";
import {DoubanMusicSyncHandler} from "./DoubanMusicSyncHandler";
import {DoubanTeleplaySyncHandler} from "./DoubanTeleplaySyncHandler";
import {DoubanGameSyncHandler} from "./DoubanGameSyncHandler";
import {DoubanOtherSyncHandler} from "./DoubanOtherSyncHandler";
import {SyncPreviewResult} from "../model/SyncPreviewResult";

export class SyncPreviewHandler {
	private syncHandlers: DoubanSyncHandler[];
	private defaultSyncHandler: DoubanSyncHandler;

	constructor(private app: App, private plugin: DoubanPlugin) {
		this.defaultSyncHandler = new DoubanOtherSyncHandler(plugin);
		this.syncHandlers = [
			new DoubanMovieSyncHandler(plugin),
			new DoubanBookSyncHandler(plugin),
			new DoubanMusicSyncHandler(plugin),
			new DoubanTeleplaySyncHandler(plugin),
			new DoubanGameSyncHandler(plugin),
			this.defaultSyncHandler,
		];
	}

	async preview(syncConfig: SyncConfig, context: HandleContext): Promise<SyncPreviewResult> {
		const syncHandler = this.syncHandlers.find(handler => handler.support(syncConfig.syncType));
		if (syncHandler) {
			return await syncHandler.preview(syncConfig, context);
		}
		return await this.defaultSyncHandler.preview(syncConfig, context);
	}
}
