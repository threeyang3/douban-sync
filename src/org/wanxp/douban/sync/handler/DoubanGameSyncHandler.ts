import {DoubanAbstractSyncHandler} from "./DoubanAbstractSyncHandler";
import {SyncType} from "../../../constant/Constsant";
import DoubanPlugin from "../../../main";
import DoubanGameLoadHandler from "../../data/handler/DoubanGameLoadHandler";
import DoubanGameSubject from "../../data/model/DoubanGameSubject";
import DoubanAbstractListHandler from "./list/DoubanAbstractListHandler";
import {DoubanSubjectState} from "../../../constant/DoubanUserState";

export class DoubanGameSyncHandler extends DoubanAbstractSyncHandler<DoubanGameSubject>{

	constructor(plugin:DoubanPlugin) {
		super(plugin, new DoubanGameLoadHandler(plugin),[
			DoubanAbstractListHandler.create(SyncType.game, DoubanSubjectState.collect),
			DoubanAbstractListHandler.create(SyncType.game, DoubanSubjectState.wish),
			DoubanAbstractListHandler.create(SyncType.game, DoubanSubjectState.do)]);
	}

	getSyncType(): SyncType {
		return SyncType.game;
	}

}
