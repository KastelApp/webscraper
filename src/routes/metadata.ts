import { errorCodes } from "../utils/errorCodes.ts";
import fetchMetaData from "../utils/fetchMetaData.ts";
import type { Handler } from "../utils/RouteHandler.ts";
import trackRedirects from "../utils/trackRedirects.ts";

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

	const fetchResponse = await fetchMetaData(targetUrl);

	if (!fetchResponse) {
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
			fetch(`${ctx.env.mediaUrl}/thumbhash/${fixedTargetUrl}`),
		);

		if (thumbhashError) {
			console.error(thumbhashError);
		}

		if (thumbhashResponse) {
			const [thumbhashData, thumbhashDataError] = await ctx.promiseHandler(
				thumbhashResponse.json() as Promise<{ thumbhash: string }>,
			);

			if (thumbhashDataError) {
				console.error(thumbhashDataError);
			}

			thumbhash = thumbhashData?.thumbhash ?? null;
		}
	}

	const { isShortener, redirectChain } = await trackRedirects(targetUrl, fetchResponse.headFail ? "GET" : "HEAD");

	const newRes = new Response(
		JSON.stringify({
			mimetype: contentType,
			mediaUrl,
			embed: contentType?.startsWith("text/html") ?? false,
			frameUrl,
			thumbhash,
			linkShortner: {
				isShortener,
				redirectChain,
			},
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
