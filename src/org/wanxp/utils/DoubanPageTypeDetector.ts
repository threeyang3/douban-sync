import {load} from "cheerio";
import {SupportType} from "../constant/Constsant";

export default class DoubanPageTypeDetector {
	static detect(html: string, fallback?: SupportType): SupportType | null {
		if (!html) {
			return fallback || null;
		}
		const document = load(html);
		const jsonLdType = this.detectJsonLdType(document);
		if (jsonLdType) {
			return jsonLdType;
		}
		const openGraphType = this.detectOpenGraphType(document);
		if (openGraphType) {
			return openGraphType;
		}
		const hasEpisode = document('#info span.pl').get()
			.some(element => /集数|单集片长/.test(document(element).text()));
		if (hasEpisode) {
			return SupportType.teleplay;
		}
		const pageText = document('body').text();
		if (/我看过的电视剧|我看过这部剧|在看这部剧/.test(pageText)) {
			return SupportType.teleplay;
		}
		return fallback || null;
	}

	private static detectJsonLdType(document: any): SupportType | null {
		const typeMap: Record<string, SupportType> = {
			Book: SupportType.book,
			Movie: SupportType.movie,
			TVSeries: SupportType.teleplay,
			MusicAlbum: SupportType.music,
			VideoGame: SupportType.game,
		};
		for (const script of document('script[type="application/ld+json"]').get()) {
			try {
				const value = JSON.parse(document(script).text().replace(/[\r\n\t]+/g, ''));
				const rawTypes = Array.isArray(value?.['@type']) ? value['@type'] : [value?.['@type']];
				for (const rawType of rawTypes) {
					if (typeMap[rawType]) {
						return typeMap[rawType];
					}
				}
			} catch (_) {
				// Continue with other metadata sources.
			}
		}
		return null;
	}

	private static detectOpenGraphType(document: any): SupportType | null {
		const typeMap: Record<string, SupportType> = {
			'books.book': SupportType.book,
			'video.movie': SupportType.movie,
			'video.tv_show': SupportType.teleplay,
			'music.album': SupportType.music,
			'video.other': SupportType.game,
		};
		const value = document('meta[property="og:type"]').attr('content');
		return value ? typeMap[value] || null : null;
	}
}
