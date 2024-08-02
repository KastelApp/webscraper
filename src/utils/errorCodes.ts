export interface ErrorCodes {
	[key: string]: { code: number; message: string };
}

/**
 * The error codes for easier debugging, For the actual codes you can do whatever, just make sure 5xxx is internal errors 4xxx is client errors
 */
export const errorCodes = {
	NO_URL_PROVIDED: {
		code: 4050,
		message: "No URL was provided, although one is required",
	},
	CACHING_ERROR: {
		code: 5999,
		message: "Something went wrong when trying to retrieve the cache... Possibly a cloudflare issue?",
	},
	META_DATA_FETCH_ERROR: {
		code: 5031,
		message: "An error occurred while trying to fetch the metadata",
	},
	EMBED_DATA_FETCH_ERROR: {
		code: 5032,
		message: "An error occurred while trying to fetch the embed data",
	},
	EMBED_DATA_FAILED_TO_CONVERT_TO_HTML: {
		code: 5033,
		message: "An error occurred while trying to convert the embed data to HTML",
	},
	RESPECTING_ROBOTS: {
		// ? nuh uh I hate robots frfr - robothater6969420 (besides copilot <3)
		code: 4031,
		message: "The URL is not allowed to be scraped",
	},
	FAILED_TO_TRY_AND_RESPECT_BOTS: {
		code: 4090,
		message: "An error occurred while trying to respect the robots.txt file",
	},
	FAILED_TO_FETCH_ROBOTS: {
		code: 4091,
		message: "An error occurred while trying to fetch the robots.txt file",
	},
} satisfies ErrorCodes;
