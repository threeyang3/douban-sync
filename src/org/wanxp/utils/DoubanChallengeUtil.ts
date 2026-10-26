import {load} from "cheerio";

export interface DoubanChallenge {
	token: string;
	challenge: string;
	redirectUrl: string;
	difficulty: number;
}

/**
 * Handles the optional proof-of-work page served by sec.douban.com.
 * Unknown formats are ignored so the normal page guard can fail closed.
 */
export class DoubanChallengeUtil {
	static readonly VERIFY_URL = "https://sec.douban.com/c";
	private static readonly DEFAULT_DIFFICULTY = 4;
	private static readonly MAX_DIFFICULTY = 6;
	private static readonly MAX_NONCE = 5_000_000;

	static parse(html: string): DoubanChallenge | null {
		if (!html || !html.includes('name="cha"') || !html.includes('name="sol"')) {
			return null;
		}

		const document = load(html);
		const form = document('form#sec, form[action="/c"]').first();
		if (form.length === 0) {
			return null;
		}

		const token = form.find('input[name="tok"]').attr("value") || "";
		const challenge = form.find('input[name="cha"]').attr("value") || "";
		const redirectUrl = form.find('input[name="red"]').attr("value") || "";
		if (!token || !challenge || !redirectUrl) {
			return null;
		}

		const difficultyMatch = html.match(/difficulty\s*=\s*(\d+)/);
		const parsedDifficulty = difficultyMatch ? Number(difficultyMatch[1]) : this.DEFAULT_DIFFICULTY;
		const difficulty = Number.isInteger(parsedDifficulty) && parsedDifficulty > 0
			? Math.min(parsedDifficulty, this.MAX_DIFFICULTY)
			: this.DEFAULT_DIFFICULTY;
		return {token, challenge, redirectUrl, difficulty};
	}

	static async solve(challenge: DoubanChallenge): Promise<number> {
		const targetPrefix = "0".repeat(challenge.difficulty);
		for (let nonce = 1; nonce <= this.MAX_NONCE; nonce++) {
			const hash = await this.sha512(challenge.challenge + nonce);
			if (hash.startsWith(targetPrefix)) {
				return nonce;
			}
			if (nonce % 500 === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}
		throw new Error("豆瓣验证计算超过最大尝试次数");
	}

	static buildRequestBody(challenge: DoubanChallenge, solution: number): string {
		return new URLSearchParams({
			tok: challenge.token,
			cha: challenge.challenge,
			sol: String(solution),
			red: challenge.redirectUrl,
		}).toString();
	}

	private static async sha512(value: string): Promise<string> {
		try {
			const nodeCrypto = require("crypto") as typeof import("crypto");
			return nodeCrypto.createHash("sha512").update(value).digest("hex");
		} catch (_) {
			if (typeof crypto === "undefined" || !crypto.subtle) {
				throw new Error("当前环境不支持 SHA-512 验证");
			}
			const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
			return Array.from(new Uint8Array(digest))
				.map(byte => byte.toString(16).padStart(2, "0"))
				.join("");
		}
	}
}
