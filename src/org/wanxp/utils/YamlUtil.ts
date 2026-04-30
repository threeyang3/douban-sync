import {DataField} from "./model/DataField";
import {DataValueType} from "../constant/Constsant";

export default class YamlUtil {

	public static hasSpecialChar(str: string): boolean {
		return SPECIAL_CHAR_REG.test(str);
	}


	public static handleSpecialChar(text: string): string {
		// return this.hasSpecialChar(text) ? text.replace(SPECIAL_CHAR_REG, (match, p1) => {
		// 	return SPECIAL_CHAR_REG_REPLACE.get(p1) || p1;
		// }) : text;
		//temp solution
		return '"' + text + '"';
	}

	public static handleText(text: string, dataField: DataField = null): string {
		if (YamlUtil.hasSpecialChar(text)) {
			// 转义双引号
			text = text.replaceAll('"', '\\"')
				// 将多个空白字符（空格、制表符等）压缩为单个空格
				.replaceAll(/\s+/g, ' ')
				// 将换行符替换为句号（用于 YAML 单行字符串）
				.replaceAll('\n', '。')
				// 合并连续的句号
				.replaceAll('。。', '。')
				// 移除开头和结尾的引号空格
				.replace(/^" /, '"') // Remove leading "
				.replace(/ "$/, '"') // Remove trailing "
			if (dataField && dataField.type === DataValueType.date) {
				return text;
			}
			YamlUtil.handleSpecialChar(text);
		}
		return text;
	}

	/**
	 * 处理多行文本，保留换行结构
	 * 用于 desc 等可能包含多段落的字段
	 * @param text 原始文本
	 * @returns 处理后的 YAML 多行字符串
	 */
	public static handleMultiLineText(text: string): string {
		if (!text) {
			return '';
		}
		// 检查是否包含特殊字符
		if (!YamlUtil.hasSpecialChar(text)) {
			return text;
		}
		// 对于多行文本，使用 YAML 块标量语法
		// 使用 | 保留换行，或者使用 > 将换行转为空格
		// 这里我们选择使用引号包裹，并将换行转为句号
		// 因为 Obsidian frontmatter 对块标量支持有限
		text = text.replaceAll('"', '\\"')
			.replaceAll('\n', '。')
			.replaceAll('。。', '。')
			.replaceAll(/\s+/g, ' ')
			.trim();
		return '"' + text + '"';
	}

}

export const SPECIAL_CHAR_REG = /[{}\[\]&*#?|\-<>=!%@:"`,\n]/;
export const TITLE_ALIASES_SPECIAL_CHAR_REG_G = /[{}\[\]&*#?|\-<>=!%@:"`,，\n]/g;

const SPECIAL_CHAR_REG_REPLACE: Map<string, string> = new Map([
	['{', '\\{'],
]);

