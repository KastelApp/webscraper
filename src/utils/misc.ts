import type { Embed } from "../types.ts";

const isString = (value: any): value is string => typeof value === "string";
const isUrl = (value: string): boolean => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value);

const extractString = (obj: any, key: string): string | undefined => {
	if (obj === null || obj === undefined) {
		return undefined;
	}

	const value = obj[key];

	return isString(value) ? value : undefined;
};

const extractUrl = (obj: any, key: string): string | undefined => {
	if (obj === null || obj === undefined) {
		return undefined;
	}

	const value = extractString(obj, key);
	return value && isUrl(value) ? value : undefined;
};

const extractNumber = (obj: any, key: string): number | undefined => {
	if (obj === null || obj === undefined) {
		return undefined;
	}

	const value = obj[key];
	const numberValue = Number.parseInt(value, 10);
	return Number.isNaN(numberValue) ? undefined : numberValue;
};

const embedMappings = {
	title: ["og:title", "title", "twitter:title"],
	description: ["og:description", "description", "twitter:description"],
	color: ["theme-color"],
	url: ["og:url", "url"],
	author: {
		name: ["og:site_name", "site_name"],
		iconUrl: ["twitter:image:src", "og:image", "image"],
		url: ["og:url", "url"],
	},
	files: {
		url: ["og:image:image", "twitter:image:image"],
		width: ["og:image:width", "twitter:image:width"],
		height: ["og:image:height", "twitter:image:height"],
	},
};

const convertOgObjectToEmbed = (ogObject: any): Embed => {
	// todo: possibly open source only this portion so people can help build out embeds better
	console.log(ogObject);
	// ? using the mappings as above
	let title =
		extractString(ogObject?.og, "title") ||
		extractString(ogObject, "title") ||
		extractString(ogObject?.twitter, "title");
	const description =
		extractString(ogObject?.og, "description") ||
		extractString(ogObject, "description") ||
		extractString(ogObject?.twitter, "description");
	const color = extractString(ogObject, "theme-color")
		? Number.parseInt(extractString(ogObject, "theme-color")!.slice(1), 16)
		: undefined;
	const url = extractUrl(ogObject?.og, "url") || extractUrl(ogObject, "url");
	let authorName = extractString(ogObject?.og, "site_name") || extractString(ogObject, "site_name");
	// const authorIconUrl = extractUrl(ogObject?.twitter?.image, "src") || extractUrl(ogObject, "image");
	let authorUrl = extractUrl(ogObject?.og, "url") || extractUrl(ogObject, "url");

	if (authorUrl && !authorName && title) {
		authorName = title;
		title = undefined;
	}

	if (title && authorUrl && url && authorUrl === url) {
		authorUrl = undefined;
	}

	console.log(title, description, color, url, authorName, authorUrl);

	return {
		title,
		description,
		color,
		url,
		author: {
			name: authorName as string,
			// iconUrl: authorIconUrl as string,
			url: authorUrl as string,
		},
		type: "Rich",
	};
};

export { extractString, extractUrl, extractNumber, isString, isUrl, convertOgObjectToEmbed };
