import promiseHandler from "./promiseHandler.ts";

/**
 * Get metadata from a url
 * @param url The url to fetch metadata from
 * @param getOnFail If we should perform a "GET" request when we get a "METHOD NOT ALLOWED" error
 * @param method The method to use for the request (This is for {@link #getOnFail})
 * @returns The response object
 */
const fetchMetaData = async (
	url: string,
	getOnFail = true,
	method: "HEAD" | "GET" = "HEAD",
): Promise<(globalThis.Response & { headFail: boolean }) | null> => {
	const signal = new AbortController();

	setTimeout(() => {
		signal.abort();
	}, 8000);

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
				// ? if its a "GET" request, we do a range of 1MB (max) of data so we don't download images
				...(method === "GET" ? { Range: "bytes=0-1048576" } : {}),
			},
			method: method,
			signal: signal.signal,
		}),
	);

	if (fetchError || !fetchResponse) {
		console.error(fetchError);

		return null;
	}

	if (fetchResponse.status === 405 && getOnFail) {
		return fetchMetaData(url, false, "GET");
	}

	if (method === "GET") {
		// @ts-expect-error -- we are fine
		fetchResponse.headFail = true;
	} else {
		// @ts-expect-error -- we are fine
		fetchResponse.headFail = false;
	}

	return fetchResponse as unknown as globalThis.Response & { headFail: boolean };
};

export default fetchMetaData;
