import SettingsManager from "../douban/setting/SettingsManager";
import {Platform, RequestUrlResponse} from "obsidian";
import DesktopHttpUtil from "./desktop/DesktopHttpUtil";
import MobileHttpUtil from "./mobile/MobileHttpUtil";
import {HttpResponse} from "./model/HttpResponse";
import {sanitizeHttpUrlForLog} from "./HttpRequestPolicy";


export default class HttpUtil {

	private static readonly IMAGE_REQUEST_HEADERS_TO_DROP = new Set([
		'authority',
		'authorization',
		'content-length',
		'content-type',
		'cookie',
		'host',
		'origin',
		'proxy-authorization',
		'referer',
		'sec-fetch-dest',
		'sec-fetch-mode',
		'sec-fetch-site',
		'sec-fetch-user',
	]);



	/**
	 * get请求
	 * @param url 请求地址
	 * @param headers 请求参数
	 * @param settingsManager 设置管理器
	 */
	public static async httpRequest(url: string, headers: any, settingsManager?: SettingsManager, options?: any): Promise<HttpResponse> {
		const method = String(options?.method || 'GET').toUpperCase();
		settingsManager?.debug(`Obsidian-Douban:HTTP ${method} ${sanitizeHttpUrlForLog(url)}`);
		if (Platform.isDesktopApp) {
			return DesktopHttpUtil.request(url, headers, settingsManager, options)
		} else {
			const response = await MobileHttpUtil.request(url, headers, settingsManager, options);
			return new HttpResponse(response.status, response.headers, response.text);
		}
	}

	/**
	 * get请求
	 * @param url 请求地址
	 * @param headers 请求参数
	 * @param settingsManager 设置管理器
	 */
	public static async getText(url: string, headers: any, settingsManager?: SettingsManager): Promise<HttpResponse> {
		settingsManager?.debug(`Obsidian-Douban:HTTP GET ${sanitizeHttpUrlForLog(url)}`);
		if (Platform.isDesktopApp) {
			return DesktopHttpUtil.request(url, headers, settingsManager, {method: 'GET'})
		} else {
			const response = await MobileHttpUtil.httpRequestGet(url, headers, settingsManager);
			return new HttpResponse(response.status, response.headers, response.text);
		}
	}

	/**
	 * get请求
	 * @param url 请求地址
	 * @param headers 请求参数
	 * @param settingsManager 设置管理器
	 */
	public static httpRequestBuffer(url: string, headers: any, settingsManager?: SettingsManager): Promise<HttpResponse> {
		if (Platform.isDesktopApp) {
			return DesktopHttpUtil.requestBuffer(url, headers, settingsManager)
		}else {
			return MobileHttpUtil.request(url, headers, settingsManager, {method: 'GET'}).then((response: RequestUrlResponse) => {
				return new HttpResponse(response.status, response.headers, response.arrayBuffer);
			});
		}
	}

	public static buildImageRequestHeaders(headers: Record<string, any> = {}, referer?: string): Record<string, string> {
		const nextHeaders: Record<string, string> = {};
		Object.entries(headers || {}).forEach(([key, value]) => {
			if (value == null || value === '') {
				return;
			}
			const lowerKey = key.toLowerCase();
			if (lowerKey === 'referer') {
				return;
			}
			if (this.IMAGE_REQUEST_HEADERS_TO_DROP.has(lowerKey) || lowerKey.startsWith('sec-ch-ua')) {
				return;
			}
			nextHeaders[key] = String(value);
		});
		if (referer) {
			nextHeaders.Referer = referer;
		}
		return nextHeaders;
	}


	public static parse(url: string): { protocol: string, host: string, port: string, path: string } {
		const regex = /^(.*?):\/\/([^\/:]+)(?::(\d+))?([^?]*)$/;
		const matches = url.match(regex);

		if (matches) {
			const protocol = matches[1];
			const host = matches[2];
			const port = matches[3] || '';
			const path = matches[4];

			return { protocol, host, port, path };
		}

		throw new Error('Invalid URL');
	}

	public static replaceUrlPath(url: string, newPath: string): string {
		const regex = /^(https?:\/\/[^\/]+)(:\d+)?(\/.*)$/;
		const matches = url.match(regex);
		if (matches && matches.length === 4) {
			return matches[1] + (matches[2] || '') + newPath;
		}
		return url;
	}

	/**
	 * 提取url
	 * @param str
	 */
	public static extractURLFromString(str: string): string  {
		const urlRegex = /(?:!\[.*?\]\()?(https?:\/\/[^\s)]+)/g;
		const matches = str.match(urlRegex);
		if (matches && matches.length > 0) {
			return matches[0];
		}
		return str;
	}

	/**
	 * 将字符进行url编码
	 * @param keyword
	 */
	static encodeUrl(keyword: string) {
		if (!keyword) {
			return '';
		}
		return encodeURIComponent(keyword);
	}
}
