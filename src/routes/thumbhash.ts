import robotsParser from "robots-parser";
import { errorCodes } from "../utils/errorCodes.ts";
import fetchMetaData from "../utils/fetchMetaData.ts";
import type { Handler } from "../utils/RouteHandler.ts";

const request: Handler = async (ctx) => {
	const url = new URL(ctx.request.url);

	const targetUrl = url.searchParams.get("url");

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

	let thumbhash: string | null = null;

	const fixedTargetUrl = encodeURIComponent(targetUrl?.replace(/(https?):\/\//g, "$1:/"));

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

	const newRes = new Response(
		JSON.stringify({
			thumbhash,
		}),
		{
			headers: { "Content-Type": "application/json" },
		},
	);

	if (process.env.NODE_ENV !== "development") {
		newRes.headers.append("Cache-Control", "s-maxage=600"); // Cache for 10 minutes
	}

	newRes.headers.append("X-URL", targetUrl);

	ctx.ctx.waitUntil(cache.put(url, newRes.clone()));

	return newRes;
};

export default request;
