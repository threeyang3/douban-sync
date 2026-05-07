import {DoubanAbstractSyncHandler} from "./DoubanAbstractSyncHandler";
import DoubanPlugin from "../../../main";
import {SyncType} from "../../../constant/Constsant";
import DoubanBookSubject from "../../data/model/DoubanBookSubject";
import DoubanBookLoadHandler from "../../data/handler/DoubanBookLoadHandler";
import DoubanAbstractListHandler from "./list/DoubanAbstractListHandler";
import {DoubanSubjectState} from "../../../constant/DoubanUserState";

export class DoubanBookSyncHandler extends DoubanAbstractSyncHandler<DoubanBookSubject> {

	constructor(plugin:DoubanPlugin) {
		super(plugin, new DoubanBookLoadHandler(plugin),[
			DoubanAbstractListHandler.create(SyncType.book, DoubanSubjectState.collect),
			DoubanAbstractListHandler.create(SyncType.book, DoubanSubjectState.wish),
			DoubanAbstractListHandler.create(SyncType.book, DoubanSubjectState.do)]);
	}

    getSyncType(): SyncType {
		return SyncType.book;
    }

}
