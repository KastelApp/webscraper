import { load } from "cheerio";
import { errorCodes } from "../utils/errorCodes.ts";
import type { Handler } from "../utils/RouteHandler.ts";
import robotsParser from "robots-parser";
import { convertOgObjectToEmbed, extractString, extractUrl } from "../utils/misc.ts";

interface MetaData {
	[key: string]: string | MetaData | MetaData[];
}

const transformMetaTags = (metaTags: Record<string, string>): MetaData => {
	console.log(metaTags);
	const result: MetaData = {};

	for (const key in metaTags) {
		const value = metaTags[key];
		const parts = key.split(":");

		parts.reduce<MetaData>((acc, part, index) => {
			if (index === parts.length - 1) {
				if (Array.isArray(acc[part])) {
					acc[part].push(value as unknown as MetaData);
				} else if (acc[part]) {
					acc[part] = [acc[part] as unknown as MetaData, value as unknown as MetaData];
				} else {
					acc[part] = value;
				}
			} else if (typeof acc[part] === "string") {
				acc[part] = { [part]: acc[part] };
			} else {
				acc[part] = acc[part] || {};
			}

			return acc[part] as MetaData;
		}, result);
	}

	return result;
};

const request: Handler = async (ctx) => {
	const url = new URL(ctx.request.url);

	const targetUrl = url.searchParams.get("url");
	const debug = url.searchParams.get("debug");

	if (!targetUrl) {
		return new Response(JSON.stringify(errorCodes.NO_URL_PROVIDED), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const cache = caches.default;
	const [response, error] = await ctx.promiseHandler(cache.match(url));

	if (error) {
		console.error(error);

		return new Response(JSON.stringify(errorCodes.CACHING_ERROR), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (response) {
		return response;
	}

	const robotsUrl = new URL(targetUrl);

	robotsUrl.pathname = "/robots.txt";

	const [robotsResponse, robotsError] = await ctx.promiseHandler(fetch(robotsUrl.toString()));

	if (robotsError || !robotsResponse) {
		console.error(robotsError);

		return new Response(JSON.stringify(errorCodes.FAILED_TO_FETCH_ROBOTS), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const [robotsContent, robotsContentText] = await ctx.promiseHandler(robotsResponse.text());

	if (robotsContentText || !robotsContent) {
		console.error(robotsContentText);

		return new Response(JSON.stringify(errorCodes.FAILED_TO_TRY_AND_RESPECT_BOTS), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const robots = robotsParser(robotsUrl.toString(), robotsContent);

	if (!robots.isAllowed(targetUrl, "KastelBot/1.0 (+https://kastel.dev/docs/topics/scraping)")) {
		return new Response(JSON.stringify(errorCodes.RESPECTING_ROBOTS), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	const [fetchResponse, fetchError] = await ctx.promiseHandler(
		fetch(targetUrl, {
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

		return new Response(JSON.stringify(errorCodes.EMBED_DATA_FETCH_ERROR), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const [html, htmlError] = await ctx.promiseHandler(fetchResponse.text());

	if (htmlError || !html) {
		console.error(htmlError);

		return new Response(JSON.stringify(errorCodes.EMBED_DATA_FAILED_TO_CONVERT_TO_HTML), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const $ = load(html);
	const metaTags: Record<string, string> = {};

	for (const elem of $("meta").toArray()) {
		const property = $(elem).attr("property");
		const name = $(elem).attr("name");
		const content = $(elem).attr("content");

		if (property?.startsWith("og:")) {
			metaTags[property] = content as string;
		} else if (name) {
			metaTags[name] = content as string;
		}
	}

	const transformedMetaTags = transformMetaTags(metaTags);

	const newRes = new Response(JSON.stringify(convertOgObjectToEmbed(transformedMetaTags), null, 2), {
		headers: { "Content-Type": "application/json" },
	});

	// newRes.headers.append("Cache-Control", "s-maxage=600"); // Cache for 10 minutes
	newRes.headers.append("X-URL", targetUrl);

	ctx.ctx.waitUntil(cache.put(url, newRes.clone()));

	return newRes;
};

export default request;
