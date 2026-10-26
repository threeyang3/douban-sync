import DoubanSubject from "../douban/data/model/DoubanSubject";
import {describeHttpError, HttpRequestError} from "./HttpRequestPolicy";

export enum DoubanPageProblem {
	empty = 'empty',
	loginRequired = 'login-required',
	accessDenied = 'access-denied',
	challengeRequired = 'challenge-required',
	unexpectedHtml = 'unexpected-html',
	invalidSubject = 'invalid-subject',
}

export type DoubanPageStage = 'response' | 'parse' | 'validation';

export interface DoubanPageInspection {
	ok: boolean;
	problem?: DoubanPageProblem;
	reason?: string;
}

export interface DoubanPageInspectOptions {
	allowFragment?: boolean;
}

export class DoubanPageGuardError extends Error {
	public readonly problem: DoubanPageProblem;
	public readonly stage: DoubanPageStage;

	constructor(problem: DoubanPageProblem, stage: DoubanPageStage, message: string) {
		super(message);
		this.name = 'DoubanPageGuardError';
		this.problem = problem;
		this.stage = stage;
	}
}

const PROBLEM_MESSAGES: Record<DoubanPageProblem, string> = {
	[DoubanPageProblem.empty]: '豆瓣返回了空响应',
	[DoubanPageProblem.loginRequired]: '豆瓣返回登录页面，请先登录或更新 Cookie',
	[DoubanPageProblem.accessDenied]: '豆瓣拒绝访问该页面',
	[DoubanPageProblem.challengeRequired]: '豆瓣要求完成人机验证，请完成验证后重试',
	[DoubanPageProblem.unexpectedHtml]: '响应不是可识别的豆瓣详情页',
	[DoubanPageProblem.invalidSubject]: '详情页缺少必要的豆瓣 ID、标题或类型',
};

export default class DoubanPageGuard {
	static inspect(html: unknown, options: DoubanPageInspectOptions = {}): DoubanPageInspection {
		const page = typeof html === 'string' ? html : '';
		if (!page.trim()) {
			return this.failure(DoubanPageProblem.empty);
		}

		const title = this.extractTitle(page);
		const hasDetailMetadata = /application\/ld\+json|property\s*=\s*["']og:title["']/i.test(page);
		if (
			/^禁止访问$/i.test(title)
			|| /^403(?:\s+forbidden)?$/i.test(title)
			|| /\/misc\/sorry/i.test(page)
		) {
			return this.failure(DoubanPageProblem.accessDenied);
		}

		const hasLoginUrl = /accounts\.douban\.com\/passport\/login/i.test(page) && !hasDetailMetadata;
		const hasLoginForm = /<form[^>]+action\s*=\s*["'][^"']*login/i.test(page);
		const isLoginTitle = /^(?:登录豆瓣|豆瓣\s*-\s*登录跳转页)$/i.test(title);
		if (hasLoginUrl || hasLoginForm || isLoginTitle) {
			return this.failure(DoubanPageProblem.loginRequired);
		}

		const isChallengeUrl = /https?:\/\/sec\.douban\.com\/a/i.test(page) && !hasDetailMetadata;
		const isChallengeTitle = /(?:安全验证|人机验证|验证码|captcha)/i.test(title);
		if (isChallengeUrl || isChallengeTitle) {
			return this.failure(DoubanPageProblem.challengeRequired);
		}

		const hasHtmlDocument = /<html(?:\s|>)/i.test(page) || /<body(?:\s|>)/i.test(page);
		if (!hasHtmlDocument && !options.allowFragment) {
			return this.failure(DoubanPageProblem.unexpectedHtml);
		}

		return {ok: true};
	}

	static assertCanParse(html: unknown, options: DoubanPageInspectOptions = {}): void {
		const inspection = this.inspect(html, options);
		if (!inspection.ok && inspection.problem) {
			throw this.createError(inspection.problem, 'response');
		}
	}

	static assertValidSubject(subject: DoubanSubject, expectedType?: string): void {
		const id = String(subject?.id || '').trim();
		const title = String(subject?.title || '').trim();
		const type = String(subject?.type || '').trim();
		const typeMatches = !expectedType || type.toLowerCase() === expectedType.toLowerCase();
		if (!id || !/^\d+$/.test(id) || !title || !type || !typeMatches) {
			throw this.createError(DoubanPageProblem.invalidSubject, 'validation');
		}
	}

	static describeError(error: unknown): string {
		if (error instanceof DoubanPageGuardError) {
			const stageNames: Record<DoubanPageStage, string> = {
				response: '页面检查',
				parse: '页面解析',
				validation: '字段校验',
			};
			return `${stageNames[error.stage]}失败：${error.message}`;
		}
		if (error instanceof HttpRequestError) {
			return `网络请求失败：${describeHttpError(error)}`;
		}
		if (error instanceof Error) {
			return `处理失败：${error.message}`;
		}
		return String(error);
	}

	private static failure(problem: DoubanPageProblem): DoubanPageInspection {
		return {
			ok: false,
			problem,
			reason: PROBLEM_MESSAGES[problem],
		};
	}

	private static createError(problem: DoubanPageProblem, stage: DoubanPageStage): DoubanPageGuardError {
		return new DoubanPageGuardError(problem, stage, PROBLEM_MESSAGES[problem]);
	}

	private static extractTitle(html: string): string {
		const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
		return match ? match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
	}
}
