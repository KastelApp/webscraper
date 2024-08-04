interface EmbedFiles {
	name?: string;
	url: string;
	height?: number;
	width?: number;
	type: "image" | "video";
	rawUrl: string;
}

interface EmbedFooter {
	text: string;
	iconUrl: string;
	timestamp: string;
}

interface EmbedField {
	name: string;
	value: string;
	inline: boolean;
}

interface EmbedAuthor {
	name: string;
	authorID?: string;
	iconUrl?: string;
	url: string;
}

interface EmbedThumbnail {
	url: string;
	rawUrl: string;
}

interface EmbedIframeSource {
	provider: "Youtube";
	url: string; // ? i.e https://www.youtube.com/embed/cMg8KaMdDYo
}

interface Embed {
	title?: string;
	description?: string;
	url?: string;
	color?: number;
	type: "Rich" | "Iframe";
	files?: EmbedFiles[];
	footer?: EmbedFooter;
	fields?: EmbedField[];
	author?: EmbedAuthor;
	thumbnail?: EmbedThumbnail;
	iframeSource?: EmbedIframeSource;
}

export type { Embed, EmbedAuthor, EmbedField, EmbedFiles, EmbedFooter, EmbedIframeSource, EmbedThumbnail };
