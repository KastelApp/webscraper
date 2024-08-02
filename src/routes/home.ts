import type { Handler } from "../utils/RouteHandler.ts";

const request: Handler = async () => {
	return new Response("You do not belong here..", { status: 200 });
};

export default request;
