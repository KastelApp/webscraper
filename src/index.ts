import RouteHandler from "./utils/RouteHandler.ts";
import home from "./routes/home.ts";
import metadata from "./routes/metadata.ts";
import embed from "./routes/embed.ts";
import thumbhash from "./routes/thumbhash.ts";

export interface Env {
	mediaUrl: string;
	authHeader: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new RouteHandler()
			.append("/", home)
			.append("/metadata", metadata, true)
			.append("/embed", embed, true)
			.append("/thumbhash", thumbhash, true)
			.handle(request, env, ctx);
	},
};
