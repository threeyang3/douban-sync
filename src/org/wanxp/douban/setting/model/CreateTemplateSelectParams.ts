import SettingsManager from "../SettingsManager";
import { DoubanPluginSetting } from "./DoubanPluginSetting";

export interface CreateTemplateSelectParams {
	containerEl: HTMLElement,
	name:string,
	desc:string,
	placeholder:string,
	key: keyof DoubanPluginSetting;
	manager: SettingsManager;
}
