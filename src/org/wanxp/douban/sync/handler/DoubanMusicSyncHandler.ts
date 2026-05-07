import {DoubanAbstractSyncHandler} from "./DoubanAbstractSyncHandler";
import DoubanPlugin from "../../../main";
import {SyncType} from "../../../constant/Constsant";
import DoubanMusicSubject from "../../data/model/DoubanMusicSubject";
import DoubanMusicLoadHandler from "../../data/handler/DoubanMusicLoadHandler";
import DoubanAbstractListHandler from "./list/DoubanAbstractListHandler";
import {DoubanSubjectState} from "../../../constant/DoubanUserState";

export class DoubanMusicSyncHandler extends DoubanAbstractSyncHandler<DoubanMusicSubject> {

	getSyncType(): SyncType {
		return SyncType.music;
	}

	constructor(plugin: DoubanPlugin) {
		super(plugin, new DoubanMusicLoadHandler(plugin), [
			DoubanAbstractListHandler.create(SyncType.music, DoubanSubjectState.collect),
			DoubanAbstractListHandler.create(SyncType.music, DoubanSubjectState.wish),
			DoubanAbstractListHandler.create(SyncType.music, DoubanSubjectState.do)]);
	}

}
