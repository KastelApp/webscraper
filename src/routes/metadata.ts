import { errorCodes } from "../utils/errorCodes.ts";
import type { Handler } from "../utils/RouteHandler.ts";

const request: Handler = async (ctx) => {
	const url = new URL(ctx.request.url);

	const targetUrl = url.searchParams.get("url");
	const includeThumbhash = url.searchParams.get("thumbhash");

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
			method: "HEAD",
		}),
	);

	if (fetchError || !fetchResponse) {
		console.error(fetchError);

		return new Response(JSON.stringify(errorCodes.META_DATA_FETCH_ERROR), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const contentType = fetchResponse.headers.get("content-type");
	const isImage = contentType?.startsWith("image/");
	const isVideo = contentType?.startsWith("video/");
	const fixedTargetUrl = encodeURIComponent(targetUrl?.replace(/(https?):\/\//g, "$1:/"));
	const mediaUrl = isImage
		? `${ctx.env.mediaUrl}/external/${fixedTargetUrl}`
		: isVideo
			? `${ctx.env.mediaUrl}/stream/${fixedTargetUrl}`
			: null;
	const frameUrl = isVideo ? `${ctx.env.mediaUrl}/frame/${fixedTargetUrl}` : null;

	let thumbhash: string | null = null;
	
	if (isImage && includeThumbhash) {
		const [thumbhashResponse, thumbhashError] = await ctx.promiseHandler(
			fetch(`${ctx.env.mediaUrl}/thumbhash/${fixedTargetUrl}`)
		);

		if (thumbhashError) {
			console.error(thumbhashError);
		}

		if (thumbhashResponse) {
			const [thumbhashData, thumbhashDataError] = await ctx.promiseHandler(thumbhashResponse.json() as Promise<{ thumbhash: string }>);
			
			if (thumbhashDataError) {
				console.error(thumbhashDataError);
			}
			
			thumbhash = thumbhashData?.thumbhash ?? null;
		}
	}
	
	const newRes = new Response(
		JSON.stringify({
			mimetype: contentType,
			mediaUrl,
			embed: contentType?.startsWith("text/html") ?? false,
			frameUrl,
			thumbhash,
		}),
		{
			headers: { "Content-Type": "application/json" },
		},
	);

	newRes.headers.append("Cache-Control", "s-maxage=600"); // ? Cache for 10 minutes
	newRes.headers.append("X-URL", targetUrl);

	ctx.ctx.waitUntil(cache.put(url, newRes.clone()));

	return newRes;
};

export default request;
