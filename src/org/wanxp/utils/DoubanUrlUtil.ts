import {SupportType} from "../constant/Constsant";

export interface ParsedDoubanUrl {
	id: string;
	type: SupportType;
	url: string;
}

export interface ParsedDoubanUrlBatch {
	items: ParsedDoubanUrl[];
	invalid: string[];
	duplicates: string[];
}

export default class DoubanUrlUtil {
	static parse(value: string): ParsedDoubanUrl | null {
		const url = this.normalizeUrl(value);
		if (!url) {
			return null;
		}

		const host = url.hostname.toLowerCase();
		if (host !== 'douban.com' && !host.endsWith('.douban.com')) {
			return null;
		}

		const path = url.pathname;
		let type: SupportType;
		let id: string;
		if (host === 'book.douban.com' && (id = this.matchId(path, /\/subject\/(\d{5,10})(?:\/|$)/))) {
			type = SupportType.book;
		} else if (host === 'music.douban.com' && (id = this.matchId(path, /\/subject\/(\d{5,10})(?:\/|$)/))) {
			type = SupportType.music;
		} else if (host === 'movie.douban.com' && (id = this.matchId(path, /\/subject\/(\d{5,10})(?:\/|$)/))) {
			type = SupportType.movie;
		} else if ((id = this.matchId(path, /\/note\/(\d{5,10})(?:\/|$)/))) {
			type = SupportType.note;
		} else if ((id = this.matchId(path, /\/game\/(\d{5,10})(?:\/|$)/))) {
			type = SupportType.game;
		} else if ((id = this.matchId(path, /\/location\/drama\/(\d{5,10})(?:\/|$)/))) {
			type = SupportType.theater;
		} else {
			return null;
		}

		url.hash = '';
		return {id, type, url: url.toString()};
	}

	static parseLines(lines: string[]): ParsedDoubanUrlBatch {
		const items: ParsedDoubanUrl[] = [];
		const invalid: string[] = [];
		const duplicates: string[] = [];
		const seen = new Set<string>();
		lines.map(line => line.trim()).filter(Boolean).forEach(line => {
			const parsed = this.parse(line);
			if (!parsed) {
				invalid.push(line);
				return;
			}
			const key = `${parsed.type}:${parsed.id}`;
			if (seen.has(key)) {
				duplicates.push(line);
				return;
			}
			seen.add(key);
			items.push(parsed);
		});
		return {items, invalid, duplicates};
	}

	private static normalizeUrl(value: string): URL | null {
		let url: URL;
		try {
			url = new URL((value || '').trim());
		} catch (_) {
			return null;
		}
		if (url.protocol !== 'https:' && url.protocol !== 'http:') {
			return null;
		}
		if (url.hostname.toLowerCase() === 'www.douban.com' && url.pathname.startsWith('/link2/')) {
			const target = url.searchParams.get('url');
			if (target) {
				try {
					url = new URL(target);
				} catch (_) {
					return null;
				}
			}
		}
		if (url.protocol !== 'https:' && url.protocol !== 'http:') {
			return null;
		}
		url.protocol = 'https:';
		return url;
	}

	private static matchId(path: string, pattern: RegExp): string {
		return path.match(pattern)?.[1] || '';
	}
}
