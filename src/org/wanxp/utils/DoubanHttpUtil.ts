import SettingsManager from "../douban/setting/SettingsManager";
import {Platform, RequestUrlResponse} from "obsidian";
import DesktopHttpUtil from "./desktop/DesktopHttpUtil";
import MobileHttpUtil from "./mobile/MobileHttpUtil";
import FileHandler from "../file/FileHandler";
import HandleContext from "../douban/data/model/HandleContext";
import {FileUtil} from "./FileUtil";
import HttpUtil from "./HttpUtil";
import {log} from "./Logutil";
import {i18nHelper} from "../lang/helper";
import {ClipboardUtil} from "./ClipboardUtil";
import DoubanHumanCheckModel from "../douban/component/DoubanHumanCheckModel";
import DoubanPageGuard, {DoubanPageGuardError, DoubanPageProblem} from "./DoubanPageGuard";
import {DoubanChallengeUtil} from "./DoubanChallengeUtil";
import {sanitizeHttpUrlForLog} from "./HttpRequestPolicy";

export class DoubanHttpUtil {
	/**
	 * get请求
	 * @param url 请求地址
	 * @param headers 请求参数
	 * @param settingsManager 设置管理器
	 */
	public static async httpRequestGet(url: string, headers: any, settingsManager?: SettingsManager): Promise<string> {
		settingsManager?.debug(`Obsidian-Douban:获取豆瓣页面 ${sanitizeHttpUrlForLog(url)}`);
		const response = await HttpUtil.getText(url, headers, settingsManager);
		if (response.status == 403) {
			throw new Error(i18nHelper.getMessage('130106'));
		}
		let html = response.textString;
		const challenge = DoubanChallengeUtil.parse(html);
		if (challenge) {
			settingsManager?.debug('Obsidian-Douban:检测到受支持的豆瓣验证页面');
			const solution = await DoubanChallengeUtil.solve(challenge);
			const challengeResponse = await HttpUtil.httpRequest(
				DoubanChallengeUtil.VERIFY_URL,
				this.buildChallengeHeaders(headers),
				settingsManager,
				{
					method: 'POST',
					body: DoubanChallengeUtil.buildRequestBody(challenge, solution),
					timeoutMs: 30_000,
				},
			);
			html = challengeResponse.textString;
			if (challengeResponse.status >= 400 || DoubanChallengeUtil.parse(html)) {
				throw new Error(`豆瓣验证失败：HTTP ${challengeResponse.status}`);
			}
		}
		return await this.humanCheck(html, url, settingsManager)
	}

	private static buildChallengeHeaders(headers: Record<string, any> = {}): Record<string, string> {
		const result: Record<string, string> = {};
		Object.entries(headers).forEach(([key, value]) => {
			const lowerKey = key.toLowerCase();
			if (
				value != null
				&& value !== ''
				&& lowerKey !== 'host'
				&& lowerKey !== 'content-length'
				&& lowerKey !== 'content-type'
			) {
				result[key] = String(value);
			}
		});
		result['Content-Type'] = 'application/x-www-form-urlencoded';
		result['Origin'] = 'https://sec.douban.com';
		result['Referer'] = 'https://sec.douban.com/';
		return result;
	}

	private fileHandler: FileHandler;

	constructor(fileHandler: FileHandler) {
		this.fileHandler = fileHandler;
	}

	public static async humanCheck(html: any, url: string, settingsManager?: SettingsManager): Promise<any> {
		if (!html) {
			return html;
		}
		if (html && html.toString().indexOf("<title>禁止访问</title>") != -1) {
			if (Platform.isDesktopApp) {
				const loginModel = new DoubanHumanCheckModel(url);
				await loginModel.load();
			}
			throw new DoubanPageGuardError(
				DoubanPageProblem.accessDenied,
				'response',
				'豆瓣拒绝访问该页面',
			);
		} else {
			return html;
		}
	}

}
