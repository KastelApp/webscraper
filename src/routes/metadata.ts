import robotsParser from "robots-parser";
import { errorCodes } from "../utils/errorCodes.ts";
import fetchMetaData from "../utils/fetchMetaData.ts";
import type { Handler } from "../utils/RouteHandler.ts";
import trackRedirects from "../utils/trackRedirects.ts";
import type { Embed } from "../types.ts";

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

	if (robotsContentText) {
		return new Response(JSON.stringify(errorCodes.FAILED_TO_TRY_AND_RESPECT_BOTS), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const robots = robotsContent ? robotsParser(robotsUrl.toString(), robotsContent) : null;
	const fetchResponse = await fetchMetaData(targetUrl);
	const contentType = fetchResponse ? fetchResponse.headers.get("content-type") : null;
	const isImage =
		contentType?.startsWith("image/") &&
		!contentType?.startsWith("image/svg+xml") &&
		!contentType?.startsWith("image/gif");
	const isVideo =
		contentType?.startsWith("video/") ||
		contentType?.startsWith("application/octet-stream") ||
		contentType?.startsWith("image/gif");
	const fixedTargetUrl = encodeURIComponent(targetUrl?.replace(/(https?):\/\//g, "$1:/"));
	const mediaUrl = isImage
		? `${ctx.env.mediaUrl}/external/${fixedTargetUrl}`
		: isVideo
			? `${ctx.env.mediaUrl}/stream/${fixedTargetUrl}`
			: null;
	const frameUrl = isVideo ? `${ctx.env.mediaUrl}/frame/${fixedTargetUrl}` : null;

	const [metadataResponse, metadataError] = await ctx.promiseHandler(
		fetch(`${ctx.env.mediaUrl}/metadata/${fixedTargetUrl}`),
	);

	if (metadataError) {
		console.error(metadataError);
	}

	const [metadataData, metadataDataError] = metadataResponse
		? await ctx.promiseHandler(metadataResponse.json() as Promise<{ thumbhash: string; height: number; width: number }>)
		: [null, null];

	if (metadataDataError) {
		console.error(metadataDataError);
	}

	const { isShortener, redirectChain } = await trackRedirects(targetUrl, fetchResponse?.headFail ? "GET" : "HEAD");

	const earlyEmbed: Partial<Embed> = {};

	if (isVideo || isImage) {
		if (isImage) {
			earlyEmbed.type = "Image";
		} else if (isVideo) {
			earlyEmbed.type = "Video";
		}

		// ? in the rare case that its a gif we want the type to be image
		if (contentType?.startsWith("image/gif")) {
			earlyEmbed.type = "Image";
		}

		earlyEmbed.files = [
			{
				url: mediaUrl!,
				rawUrl: targetUrl,
				type: earlyEmbed.type as "Image" | "Video",
				thumbHash: metadataData?.thumbhash ?? null,
				height: metadataData?.height,
				width: metadataData?.width,
			},
		];
	}

	const newRes = new Response(
		JSON.stringify({
			mimetype: contentType,
			mediaUrl,
			embed:
				contentType?.startsWith("text/html") &&
				robots &&
				robots.isAllowed(targetUrl, "KastelBot/1.0 (+https://kastel.dev/docs/topics/scraping)"),
			frameUrl,
			thumbhash: metadataData?.thumbhash ?? null,
			linkShortner: {
				isShortener,
				redirectChain,
			},
			// ? Early embed is ONLY shown in the rare cases where we don't need to fetch /embed to scrape the site
			// ? Mainly its for images and videosz
			earlyEmbed,
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
