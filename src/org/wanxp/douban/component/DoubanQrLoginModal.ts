import {App, ButtonComponent, Modal, Notice} from "obsidian";
import SettingsManager from "../setting/SettingsManager";
import {i18nHelper} from "../../lang/helper";
import {HttpResponse} from "../../utils/model/HttpResponse";
import HttpUtil from "../../utils/HttpUtil";
import {
	DoubanCookieJar,
	DoubanQrLoginStatus,
	getDoubanQrContent,
	parseDoubanQrLoginStatus,
} from "../../utils/DoubanQrLoginUtil";
import * as QRCode from "qrcode";

const LOGIN_PAGE = 'https://accounts.douban.com/passport/login';
const QR_CODE_URL = 'https://accounts.douban.com/j/mobile/login/qrlogin_code';
const QR_STATUS_URL = 'https://accounts.douban.com/j/mobile/login/qrlogin_status';
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_COUNT = 120;
const MAX_CONSECUTIVE_ERRORS = 3;

export default class DoubanQrLoginModal extends Modal {
	private readonly settingsManager: SettingsManager;
	private readonly onLoginSuccess: () => void;
	private readonly cookies = new DoubanCookieJar();
	private qrCode = '';
	private pollTimer: number | null = null;
	private pollCount = 0;
	private consecutiveErrors = 0;
	private polling = false;
	private closed = false;
	private sessionId = 0;
	private statusEl: HTMLElement;
	private qrImageEl: HTMLImageElement;
	private refreshButton: ButtonComponent;

	constructor(app: App, settingsManager: SettingsManager, onLoginSuccess: () => void) {
		super(app);
		this.settingsManager = settingsManager;
		this.onLoginSuccess = onLoginSuccess;
	}

	onOpen(): void {
		this.closed = false;
		const {contentEl} = this;
		contentEl.empty();
		contentEl.addClass('obsidian_douban_qr_login');
		contentEl.createEl('h2', {text: i18nHelper.getMessage('100141')});
		contentEl.createEl('p', {text: i18nHelper.getMessage('100142')});

		const imageContainer = contentEl.createDiv('obsidian_douban_qr_image_container');
		this.qrImageEl = imageContainer.createEl('img', {
			attr: {alt: i18nHelper.getMessage('100141')},
		});
		this.qrImageEl.addEventListener('error', () => {
			if (!this.closed) {
				this.setStatus(i18nHelper.getMessage('100149'), true);
			}
		});
		this.qrImageEl.style.display = 'none';
		this.statusEl = contentEl.createDiv('obsidian_douban_qr_status');

		const controls = contentEl.createDiv('obsidian_douban_qr_controls');
		this.refreshButton = new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('100150'))
			.onClick(() => void this.loadQrCode());
		new ButtonComponent(controls)
			.setButtonText(i18nHelper.getMessage('110005'))
			.onClick(() => this.close());
		void this.loadQrCode();
	}

	onClose(): void {
		this.closed = true;
		this.sessionId++;
		this.stopPolling();
		this.contentEl.empty();
	}

	private async loadQrCode(): Promise<void> {
		this.stopPolling();
		const sessionId = ++this.sessionId;
		this.cookies.clear();
		this.qrCode = '';
		this.pollCount = 0;
		this.consecutiveErrors = 0;
		this.polling = false;
		this.qrImageEl.style.display = 'none';
		this.refreshButton.setDisabled(true);
		this.setStatus(i18nHelper.getMessage('100143'));

		try {
			const response = await this.request(QR_CODE_URL, 'POST', sessionId);
			const payload = response.textJson?.payload;
			if (!payload?.code || !payload?.img) {
				throw new Error('豆瓣二维码响应缺少 code 或图片地址');
			}
			if (this.closed || sessionId !== this.sessionId) {
				return;
			}
			this.qrCode = String(payload.code);
			this.qrImageEl.src = await this.renderQrImage(this.qrCode, String(payload.img), sessionId);
			if (sessionId !== this.sessionId || this.closed) {
				return;
			}
			this.qrImageEl.style.display = '';
			this.setStatus(i18nHelper.getMessage('100144'));
			this.schedulePolling(sessionId);
		} catch (error) {
			if (sessionId !== this.sessionId || this.closed) {
				return;
			}
			this.settingsManager.debug('配置界面:二维码加载失败');
			this.setStatus(i18nHelper.getMessage('100149'), true);
		} finally {
			if (sessionId === this.sessionId && !this.closed) {
				this.refreshButton.setDisabled(false);
			}
		}
	}

	private schedulePolling(sessionId: number): void {
		if (this.closed || !this.qrCode || sessionId !== this.sessionId) {
			return;
		}
		this.pollTimer = window.setTimeout(() => {
			void this.pollLoginStatus(sessionId);
		}, POLL_INTERVAL_MS);
	}

	private async pollLoginStatus(sessionId: number): Promise<void> {
		if (this.closed || !this.qrCode || this.polling || sessionId !== this.sessionId) {
			return;
		}
		if (++this.pollCount > MAX_POLL_COUNT) {
			this.setStatus(i18nHelper.getMessage('100147'), true);
			return;
		}

		this.polling = true;
		let continuePolling = false;
		try {
			const response = await this.request(
				`${QR_STATUS_URL}?code=${encodeURIComponent(this.qrCode)}`,
				'GET',
				sessionId,
			);
			const responseJson = response.textJson;
			if (!responseJson || responseJson.status !== 'success') {
				throw new Error('豆瓣二维码状态响应异常');
			}
			this.consecutiveErrors = 0;
			const loginStatus = parseDoubanQrLoginStatus(responseJson.payload);
			switch (loginStatus) {
				case DoubanQrLoginStatus.pending:
					this.setStatus(i18nHelper.getMessage('100144'));
					continuePolling = true;
					break;
				case DoubanQrLoginStatus.scanned:
					this.setStatus(i18nHelper.getMessage('100145'));
					continuePolling = true;
					break;
				case DoubanQrLoginStatus.confirmed:
					this.setStatus(i18nHelper.getMessage('100152'));
					await this.completeLogin(sessionId);
					break;
				case DoubanQrLoginStatus.invalid:
					this.setStatus(i18nHelper.getMessage('100147'), true);
					break;
				case DoubanQrLoginStatus.cancelled:
					this.setStatus(i18nHelper.getMessage('100148'), true);
					break;
				default:
					continuePolling = true;
			}
		} catch (error) {
			if (sessionId !== this.sessionId || this.closed) {
				return;
			}
			this.consecutiveErrors++;
			this.settingsManager.debug(`配置界面:二维码状态查询失败:${this.safeError(error)}`);
			if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
				this.setStatus(i18nHelper.getMessage('100149'), true);
			} else {
				continuePolling = true;
			}
		} finally {
			this.polling = false;
			if (continuePolling && sessionId === this.sessionId) {
				this.schedulePolling(sessionId);
			}
		}
	}

	private async completeLogin(sessionId: number): Promise<void> {
		if (sessionId !== this.sessionId || this.closed) {
			return;
		}
		const cookie = this.cookies.toCookieHeader();
		if (!this.cookies.has('dbcl2') || !cookie) {
			this.setStatus(i18nHelper.getMessage('100153'), true);
			return;
		}

		let user;
		try {
			user = await this.settingsManager.plugin.userComponent.loginCookie(cookie);
		} catch (error) {
			this.settingsManager.debug(`配置界面:扫码凭证已获取，用户资料验证失败:${this.safeError(error)}`);
		}
		if (sessionId !== this.sessionId || this.closed) {
			return;
		}

		let verified = !!user?.id && !!user?.login;
		if (!verified) {
			user = await this.settingsManager.plugin.userComponent.acceptQrLoginCookie(cookie);
			verified = false;
		}
		if (!user?.login) {
			this.setStatus(i18nHelper.getMessage('100153'), true);
			return;
		}

		const message = i18nHelper.getMessage(verified ? '100146' : '100154');
		this.setStatus(message);
		new Notice(message);
		this.close();
		this.onLoginSuccess();
	}

	private async request(url: string, method: string, sessionId: number): Promise<HttpResponse> {
		const response = await HttpUtil.httpRequest(
			url,
			{
				Accept: 'application/json, text/plain, */*',
				'Cache-Control': 'no-cache',
				'Content-Type': 'application/x-www-form-urlencoded',
				Referer: LOGIN_PAGE,
				'X-Requested-With': 'XMLHttpRequest',
			},
			this.settingsManager,
			{
				method,
				body: method === 'POST' ? '' : undefined,
				timeoutMs: 30_000,
			},
		);
		if (sessionId !== this.sessionId || this.closed) {
			throw new Error('二维码登录会话已结束');
		}
		if (this.isDoubanUrl(url)) {
			this.cookies.update(response.headers);
		}
		if (response.status < 200 || response.status >= 300) {
			throw new Error(`豆瓣二维码请求失败：HTTP ${response.status}`);
		}
		return response;
	}

	private isDoubanUrl(url: string): boolean {
		try {
			const hostname = new URL(url).hostname.replace(/^\./, '').toLowerCase();
			return hostname === 'douban.com' || hostname.endsWith('.douban.com');
		} catch (_) {
			return false;
		}
	}

	private async renderQrImage(code: string, imageUrl: string, sessionId: number): Promise<string> {
		const content = getDoubanQrContent(code, imageUrl);
		const dataUrl = await QRCode.toDataURL(content, {
			errorCorrectionLevel: 'M',
			margin: 2,
			width: 280,
			color: {
				dark: '#000000',
				light: '#ffffff',
			},
		});
		if (sessionId !== this.sessionId || this.closed) {
			throw new Error('二维码登录会话已结束');
		}
		return dataUrl;
	}

	private stopPolling(): void {
		if (this.pollTimer != null) {
			window.clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}
	}

	private setStatus(message: string, error = false): void {
		if (!this.statusEl || this.closed) {
			return;
		}
		this.statusEl.setText(message);
		this.statusEl.toggleClass('has_error', error);
	}

	private safeError(error: unknown): string {
		return (error instanceof Error ? error.message : String(error))
			.replace(/([?&]code=)[^&\s]+/gi, '$1<redacted>')
			.replace(/(dbcl2=)[^;\s]+/gi, '$1<redacted>');
	}
}
