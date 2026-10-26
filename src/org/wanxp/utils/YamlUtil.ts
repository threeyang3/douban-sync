import {DataField} from "./model/DataField";
import {DataValueType} from "../constant/Constsant";

export default class YamlUtil {

	public static hasSpecialChar(str: string): boolean {
		return SPECIAL_CHAR_REG.test(str);
	}


	public static handleText(text: string, dataField: DataField = null): string {
		if (!YamlUtil.hasSpecialChar(text)) {
			return text;
		}
		// Obsidian frontmatter 能直接识别 [[wiki link]]，无需加引号
		if (/^\[\[.+\]\]$/.test(text)) {
			return text;
		}
		// 多行文本使用 YAML 块标量语法，保留换行结构
		if (text.includes('\n')) {
			const lines = text.split('\n');
			return '|\n' + lines.map(line => '  ' + line).join('\n');
		}
		if (dataField && dataField.type === DataValueType.date) {
			return text;
		}
		// 单行特殊字符：双引号包裹
		text = text.replaceAll('"', '\\"')
			.replaceAll(/\s+/g, ' ')
			.replaceAll('。。', '。')
			.replace(/^" /, '"')
			.replace(/ "$/, '"');
		return '"' + text + '"';
	}

	/**
	 * 处理多行文本，保留换行结构
	 * 用于 desc 等可能包含多段落的字段
	 */
	public static handleMultiLineText(text: string): string {
		return YamlUtil.handleText(text);
	}

}

export const SPECIAL_CHAR_REG = /[{}\[\]&*#?|\-<>=!%@:"`,\n]/;
export const TITLE_ALIASES_SPECIAL_CHAR_REG_G = /[{}\[\]&*#?|\-<>=!%@:"`,，\n]/g;
