import DoubanPlugin from "../../../main";
import DoubanTheaterLoadHandler from "../../data/handler/DoubanTheaterLoadHandler";

/**
 * Retains the legacy AI handler entry point while sharing the maintained
 * semantic theater parser.
 */
export default class DoubanTheaterAiLoadHandler extends DoubanTheaterLoadHandler {
	constructor(doubanPlugin: DoubanPlugin) {
		super(doubanPlugin);
	}
}
