import robotsParser from "robots-parser";
import { load } from "cheerio";
import type { Embed } from "../types.ts";
import promiseHandler from "./promiseHandler.ts";
import { errorCodes } from "./errorCodes.ts";
import type { Env } from "../index.ts";
import { parseMapping, type MappingRules } from "./ruleParser.ts";

class EmbedParser {
	private env: Env;

	public url: string;

	public baseRules: MappingRules = {
		description: { values: ["og.description", "twitter.description", "description"], maxValues: 1 },
		title: { values: ["og.title", "title"], maxValues: 1 },
		url: { values: ["og.url", "twitter.url", "url"], maxValues: 1 },
		color: {
			values: ["theme-color"],
			maxValues: 1,
			parse: (color: string | number): number | undefined => {
				// ? handles hexes, plain numbers, as well as rgba
				if (typeof color === "number") {
					return color;
				}

				if (typeof color === "string") {
					if (color.startsWith("#")) {
						return Number.parseInt(color.slice(1), 16);
					}

					if (color.startsWith("rgb")) {
						const [r, g, b] = color.match(/\d+/g)!.map(Number);
						return (r << 16) + (g << 8) + b;
					}
				}

				return undefined;
			},
		},
		author: {
			name: { values: ["author_name"], maxValues: 1 },
			url: { values: ["author_url"], maxValues: 1 },
		},
		provider: {
			name: { values: ["provider_name"], maxValues: 1 },
			url: { values: ["provider_url"], maxValues: 1 },
		},
		files: {
			type: "array",
			options: {
				url: {
					values: ["og.image.image", "twitter.image.src"],
					maxValues: 1,
					parse: (url: string) =>
						`${this.env.mediaUrl}/external/${encodeURIComponent(url.replace(/(https?):\/\//g, "$1:/"))}`,
				},
				rawUrl: { values: ["og.image.image", "twitter.image.src"], maxValues: 1 },
				width: {
					values: ["og.image.width", "twitter.image.width"],
					maxValues: 1,
					parse: (width: string) => Number.parseInt(width),
				},
				height: {
					values: ["og.image.height", "twitter.image.height"],
					maxValues: 1,
					parse: (height: string) => Number.parseInt(height),
				},
				thumbHash: {
					values: ["og.image.image", "twitter.image.src"],
					maxValues: 1,
					parse: async (url: string) => {
						return "test";
					},
				},
			},
			maxValues: 5,
		},
	};

	private youtubeRules: MappingRules = {
		author: {
			name: { values: ["youtube_author"], maxValues: 1 },
			url: { values: ["youtube_author_link"], maxValues: 1 },
			iconUrl: {
				values: ["youtube_channel_icon"],
				maxValues: 1,
				parse: (value: string) => {
					return `${this.env.mediaUrl}/external/${encodeURIComponent(value.replace(/(https?):\/\//g, "$1:/"))}`;
				},
			},
		},
		color: this.baseRules.color,
		title: { values: ["og.title", "title"], maxValues: 1 },
		iframeSource: {
			url: {
				values: ["og.video.url", "og.video.secure_url", "og.video.embed_url", "og.video.iframe_url"],
				maxValues: 1,
			},
			provider: {
				values: ["og.site_name"],
				maxValues: 1,
			},
		},
	};

	public constructor(url: string, env: Env) {
		this.url = url;
		this.env = env;

		this.rewriteUrl();
	}

	private rewriteUrl() {
		// ? If its TikTok or Twitter, rewrite to fxtwitter.com and tnktok.com respectively this is so we can get better scraping results
		if (this.isTikTok()) {
			this.url = this.url.replace("tiktok.com", "tnktok.com");
		} else if (this.isTwitterSlashX()) {
			this.url = this.url.replace("twitter.com", "fxtwitter.com");
			this.url = this.url.replace("x.com", "fxtwitter.com");
		}
	}

	public async canScrape(): Promise<true | { code: number; message: string }> {
		const robotsUrl = new URL(this.url);

		robotsUrl.pathname = "/robots.txt";

		console.log(robotsUrl.toString());

		const [robotsResponse, robotsError] = await promiseHandler(fetch(robotsUrl.toString()));

		if (robotsError || !robotsResponse) {
			console.error(robotsError);

			return errorCodes.FAILED_TO_FETCH_ROBOTS;
		}

		const [robotsContent, robotsContentText] = await promiseHandler(robotsResponse.text());

		if (robotsContentText || !robotsContent) {
			console.error(robotsContentText);

			return errorCodes.FAILED_TO_TRY_AND_RESPECT_BOTS;
		}

		const robots = robotsParser(robotsUrl.toString(), robotsContent);

		if (!robots.isAllowed(this.url, "KastelBot/1.0 (+https://kastel.dev/docs/topics/scraping)")) {
			return errorCodes.RESPECTING_ROBOTS;
		}

		return true;
	}

	public transformMetaTags(obj: Record<string, string | string[]>) {
		const newObj: Record<string, any> = {};
		const grouped: Record<string, Record<string, any>> = {};

		for (const key in obj) {
			const keyParts = key.split(":");
			const mainKey = keyParts[0];
			const subKey = keyParts.slice(1).join(":");

			if (keyParts.length > 1) {
				if (!grouped[mainKey]) {
					grouped[mainKey] = {};
				}
				grouped[mainKey][subKey] = obj[key];
			} else {
				newObj[key] = obj[key];
			}
		}

		for (const key in grouped) {
			const item = grouped[key];
			const newBuiltObject: Record<string, any> = {};

			const baseKeys = Object.keys(item).map((k) => k.split(":")[0]);

			const uniqueBaseKeys = [...new Set(baseKeys)];

			for (const baseKey of uniqueBaseKeys) {
				const relatedKeys = Object.keys(item).filter((k) => k.startsWith(baseKey));
				const values = relatedKeys.map((rk) => item[rk]);

				if (Array.isArray(values[0])) {
					newBuiltObject[baseKey] = values[0].map((_: any, index: number) => {
						const obj: Record<string, any> = {};
						relatedKeys.forEach((rk, idx) => {
							const subKey = rk.replace(`${baseKey}:`, "") || baseKey;
							obj[subKey] = Array.isArray(values[idx]) ? values[idx][index] : values[idx];
						});
						return obj;
					});
				} else if (relatedKeys.length > 1) {
					const singleObject: Record<string, any> = {};
					relatedKeys.forEach((rk, idx) => {
						const subKey = rk.replace(`${baseKey}:`, "") || baseKey;
						singleObject[subKey] = values[idx];
					});
					newBuiltObject[baseKey] = singleObject;
				} else {
					newBuiltObject[baseKey] = item[baseKey];
				}
			}

			newObj[key] = newBuiltObject;
		}

		return newObj;
	}

	public cleanupObject(obj: Record<string, unknown>): Record<string, unknown> {
		if (typeof obj !== "object" || obj === null || obj === undefined) {
			return obj;
		}

		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				const value = obj[key];

				if (typeof value === "object" && value !== null) {
					obj[key] = this.cleanupObject(value as Record<string, unknown>);
				}

				if (value === undefined || (typeof value === "object" && Object.keys(value ?? {}).length === 0)) {
					delete obj[key];
				}
			}
		}

		return obj;
	}

	public async parseEmbed(ogObject: any, rules: MappingRules): Promise<Embed> {
		const embed = this.cleanupObject(parseMapping(rules, ogObject)) as unknown as Embed;

		if (this.isYoutube()) {
			const url = new URL(this.url);

			const vTag = url.searchParams.get("v");

			embed.iframeSource = {
				provider: "Youtube",
				url: `https://www.youtube.com/embed/${vTag}`,
			};

			embed.files = [
				{
					type: "Image",
					rawUrl: `https://i.ytimg.com/vi/${vTag}/maxresdefault.jpg`,
					url: `${this.env.mediaUrl}/external/${encodeURIComponent(`https:/i.ytimg.com/vi/${vTag}/maxresdefault.jpg`)}`,
					name: "YoutubeThumbnail",
					thumbHash: await this.fetchThumbhash(`https:/i.ytimg.com/vi/${vTag}/maxresdefault.jpg`),
				},
			];

			embed.type = "Iframe";
		} else {
			embed.type = "Site";
		}

		console.log(ogObject);

		return embed;
	}

	public async scrape(raw = false): Promise<Embed | { code: number; message: string }> {
		const canScrape = await this.canScrape();

		if (canScrape !== true) {
			return canScrape;
		}

		if (this.isSpotify() && !raw) {
			return {
				type: "Iframe",
				iframeSource: {
					provider: "Spotify",
					url: this.url.replace("open.spotify.com", "open.spotify.com/embed"),
				},
			};
		}

		const [fetchResponse, fetchError] = await promiseHandler(
			fetch(this.url, {
				headers: {
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
					"User-Agent": "KastelBot/1.0 (+https://kastel.dev/docs/topics/scraping)",
					"accept-language": "en-US,en;q=0.9",
					"cache-control": "no-cache",
					"device-memory": "8",
					dnt: "1",
					downlink: "10",
					dpr: "1",
					ect: "4g",
					pragma: "no-cache",
					priority: "u=0, i",
					rtt: "250",
					"sec-ch-device-memory": "8",
					"sec-ch-dpr": "1",
					"sec-ch-ua": '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
					"sec-ch-ua-mobile": "?0",
					"sec-ch-ua-platform": '"Windows"',
					"sec-ch-ua-platform-version": '"15.0.0"',
					"sec-ch-viewport-width": "1234",
					"sec-fetch-dest": "document",
					"sec-fetch-mode": "navigate",
					"sec-fetch-site": "none",
					"sec-fetch-user": "?1",
					"upgrade-insecure-requests": "1",
					"viewport-width": "1234",
				},
				method: "GET",
			}),
		);

		if (fetchError || !fetchResponse) {
			console.error(fetchError);

			return errorCodes.EMBED_DATA_FETCH_ERROR;
		}

		const [html, htmlError] = await promiseHandler(fetchResponse.text());

		if (htmlError || !html) {
			console.error(htmlError);

			return errorCodes.EMBED_DATA_FAILED_TO_CONVERT_TO_HTML;
		}

		const $ = load(html);
		const metaTags: Record<string, string | string[]> = {};
		const oembed = $('link[type="application/json+oembed"]').attr("href");

		for (const elem of $("meta").toArray()) {
			const property = $(elem).attr("property");
			const name = $(elem).attr("name");
			const content = $(elem).attr("content");

			if (property?.startsWith("og:")) {
				if (metaTags[property]) {
					if (Array.isArray(metaTags[property])) {
						metaTags[property].push(content as string);
					} else {
						metaTags[property] = [metaTags[property] as string, content as string];
					}
				} else {
					metaTags[property] = content as string;
				}
			} else if (name) {
				if (metaTags[name]) {
					if (Array.isArray(metaTags[name])) {
						metaTags[name].push(content as string);
					} else {
						metaTags[name] = [metaTags[name] as string, content as string];
					}
				} else {
					metaTags[name] = content as string;
				}
			}
		}

		const attemptedOembed = oembed ? await this.attemptOembed(oembed as string) : null;

		if (attemptedOembed) {
			Object.assign(metaTags, attemptedOembed);
		}

		if (this.isYoutube()) {
			const author = $('span[itemprop="author"] link[itemprop="name"]').attr("content");
			const link = $('span[itemprop="author"] link[itemprop="url"]').attr("href");
			const regex =
				/"videoSecondaryInfoRenderer":\s*{\s*"owner":\s*{\s*"videoOwnerRenderer":\s*{\s*"thumbnail":\s*{\s*"thumbnails":\s*\[\s*{\s*"url":\s*"([^"]+)"/;
			const match = html.match(regex);
			const channelIcon = match?.[1].replace(/=s48/, "=s256");

			metaTags["youtube_author"] = author as string;
			metaTags["youtube_author_link"] = link as string;
			metaTags["youtube_channel_icon"] = channelIcon as string;
		}

		console.log(metaTags);

		const transformedMetaTags = this.transformMetaTags(metaTags as Record<string, string>);
		const embed = this.parseEmbed(transformedMetaTags, this.isYoutube() ? this.youtubeRules : this.baseRules);

		if (raw) {
			return transformedMetaTags as unknown as Embed;
		}

		return embed;
	}

	public async attemptOembed(url: string): Promise<null | Record<string, any>> {
		const [fetchResponse, fetchError] = await promiseHandler(
			fetch(url, {
				headers: {
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
					"User-Agent": "KastelBot/1.0 (+https://kastel.dev/docs/topics/scraping)",
					"accept-language": "en-US,en;q=0.9",
					"cache-control": "no-cache",
					"device-memory": "8",
					dnt: "1",
					downlink: "10",
					dpr: "1",
					ect: "4g",
					pragma: "no-cache",
					priority: "u=0, i",
					rtt: "250",
					"sec-ch-device-memory": "8",
					"sec-ch-dpr": "1",
					"sec-ch-ua": '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
					"sec-ch-ua-mobile": "?0",
					"sec-ch-ua-platform": '"Windows"',
					"sec-ch-ua-platform-version": '"15.0.0"',
					"sec-ch-viewport-width": "1234",
					"sec-fetch-dest": "document",
					"sec-fetch-mode": "navigate",
					"sec-fetch-site": "none",
					"sec-fetch-user": "?1",
					"upgrade-insecure-requests": "1",
					"viewport-width": "1234",
				},
				method: "GET",
			}),
		);

		if (fetchError || !fetchResponse) {
			console.error(fetchError);

			return null;
		}

		const [json, jsonError] = await promiseHandler(fetchResponse.json());

		if (jsonError || !json) {
			console.error(jsonError);

			return null;
		}

		return json;
	}

	public isYoutube(): boolean {
		return this.url.startsWith("https://www.youtube.com") || this.url.startsWith("https://youtube.com");
	}

	public isTikTok(): boolean {
		return this.url.startsWith("https://www.tiktok.com") || this.url.startsWith("https://tiktok.com");
	}

	public isTwitterSlashX(): boolean {
		return (
			this.url.startsWith("https://twitter.com") ||
			this.url.startsWith("https://www.twitter.com") ||
			this.url.startsWith("https://x.com") ||
			this.url.startsWith("https://www.x.com")
		);
	}

	public isSpotify(): boolean {
		return this.url.startsWith("https://open.spotify.com");
	}

	public async fetchThumbhash(url: string): Promise<string | null> {
		const [thumbhashResponse, thumbhashError] = await promiseHandler(fetch(`${this.env.mediaUrl}/thumbhash/${url}`));

		if (thumbhashError || !thumbhashResponse) {
			return null;
		}

		const [thumbhashData, thumbhashDataError] = await promiseHandler(
			thumbhashResponse.json() as Promise<{ thumbhash: string }>,
		);

		if (thumbhashDataError) {
			console.error(thumbhashDataError);
		}

		return thumbhashData?.thumbhash ?? null;
	}
}

export default EmbedParser;
