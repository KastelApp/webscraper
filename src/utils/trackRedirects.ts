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

		const [response, error] = await promiseHandler(
			fetch(currentUrl, {
				method: method,
				redirect: "manual",
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
					accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
					"accept-language": "en-US,en;q=0.9",
					priority: "u=0, i",
					"sec-ch-ua": '"Not)A;Brand";v="99", "Microsoft Edge";v="127", "Chromium";v="127"',
					"sec-ch-ua-mobile": "?0",
					"sec-ch-ua-platform": '"Windows"',
					"sec-fetch-dest": "document",
					"sec-fetch-mode": "navigate",
					"sec-fetch-site": "none",
					"sec-fetch-user": "?1",
					"upgrade-insecure-requests": "1",
				},
			}),
		);

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
