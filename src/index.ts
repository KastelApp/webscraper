import RouteHandler from "./utils/RouteHandler.ts";
import home from "./routes/home.ts";
import metadata from "./routes/metadata.ts";
import embed from "./routes/embed.ts";

export interface Env {
	mediaUrl: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return new RouteHandler()
			.append("/", home)
			.append("/metadata", metadata)
			.append("/embed", embed)
			.handle(request, env, ctx);
	},
};
