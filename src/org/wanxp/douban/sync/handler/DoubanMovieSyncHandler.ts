import {DoubanAbstractSyncHandler} from "./DoubanAbstractSyncHandler";
import {SyncType} from "../../../constant/Constsant";
import DoubanMovieLoadHandler from "../../data/handler/DoubanMovieLoadHandler";
import DoubanMovieSubject from "../../data/model/DoubanMovieSubject";
import DoubanPlugin from "../../../main";
import DoubanAbstractListHandler from "./list/DoubanAbstractListHandler";
import {DoubanSubjectState} from "../../../constant/DoubanUserState";

export class DoubanMovieSyncHandler extends DoubanAbstractSyncHandler<DoubanMovieSubject>{

	constructor(plugin:DoubanPlugin) {
		super(plugin, new DoubanMovieLoadHandler(plugin),[
			DoubanAbstractListHandler.create(SyncType.movie, DoubanSubjectState.collect),
			DoubanAbstractListHandler.create(SyncType.movie, DoubanSubjectState.wish),
			DoubanAbstractListHandler.create(SyncType.movie, DoubanSubjectState.do)]);
	}

	getSyncType(): SyncType {
		return SyncType.movie;
	}

}
