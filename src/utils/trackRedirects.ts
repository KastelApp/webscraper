import promiseHandler from "./promiseHandler.ts";

/**
 * Track redirects of a url
 * @param initialUrl The initial url to track
 * @param method The method (GET / HEAD) in case the domain does not allow for HEAD requests (Which scam sites often do not)
 * @returns If its a shortener and the redirect chain
 */
const trackRedirects = async (
	initialUrl: string,
	method: "GET" | "HEAD" = "HEAD",
): Promise<{ isShortener: boolean; redirectChain: string[] }> => {
	let currentUrl = initialUrl;
	const visitedUrls: string[] = [];

	while (currentUrl) {
		visitedUrls.push(currentUrl);
		const [response, error] = await promiseHandler(fetch(currentUrl, { method: method, redirect: "manual" }));

		console.log(response, error);

		if (error || !response) {
			return { isShortener: false, redirectChain: visitedUrls };
		}

		const location = response.headers.get("location");
		if (!location) {
			break;
		}

		currentUrl = new URL(location, currentUrl).toString();
	}

	const isShortener = visitedUrls.length > 1;

	return { isShortener, redirectChain: visitedUrls };
};

export default trackRedirects;
