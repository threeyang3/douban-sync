import {DoubanAbstractSyncHandler} from "./DoubanAbstractSyncHandler";
import {SyncType} from "../../../constant/Constsant";
import DoubanPlugin from "../../../main";
import DoubanTeleplaySubject from "../../data/model/DoubanTeleplaySubject";
import {DoubanTeleplayLoadHandler} from "../../data/handler/DoubanTeleplayLoadHandler";
import DoubanAbstractListHandler from "./list/DoubanAbstractListHandler";
import {DoubanSubjectState} from "../../../constant/DoubanUserState";

export class DoubanTeleplaySyncHandler extends DoubanAbstractSyncHandler<DoubanTeleplaySubject>{

	constructor(plugin:DoubanPlugin) {
		super(plugin, new DoubanTeleplayLoadHandler(plugin),[
			DoubanAbstractListHandler.create(SyncType.teleplay, DoubanSubjectState.collect),
			DoubanAbstractListHandler.create(SyncType.teleplay, DoubanSubjectState.wish),
			DoubanAbstractListHandler.create(SyncType.teleplay, DoubanSubjectState.do)]);
	}

	getSyncType(): SyncType {
		return SyncType.teleplay;
	}

}
