import { errorCodes } from "../utils/errorCodes.ts";
import type { Handler } from "../utils/RouteHandler.ts";
import EmbedParser from "../utils/EmbedParser.ts";

const request: Handler = async (ctx) => {
	const url = new URL(ctx.request.url);

	const targetUrl = url.searchParams.get("url");
	const raw = url.searchParams.get("raw");

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

	const embedParser = new EmbedParser(targetUrl, ctx.env);

	const embed = await embedParser.scrape(raw === "true");

	const newRes = new Response(JSON.stringify(embed), {
		headers: { "Content-Type": "application/json" },
		status: "code" in embed ? (embed.code === errorCodes.RESPECTING_ROBOTS.code ? 403 : 500) : 200,
	});

	if (process.env.NODE_ENV !== "development") {
		newRes.headers.append("Cache-Control", "s-maxage=600"); // Cache for 10 minutes
	}

	newRes.headers.append("X-URL", targetUrl);

	ctx.ctx.waitUntil(cache.put(url, newRes.clone()));

	return newRes;
};

export default request;
