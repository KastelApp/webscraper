import type { Handler } from "../utils/RouteHandler.ts";

const request: Handler = async () => {
	return new Response("You do not belong here..", { status: 401 });
};

export default request;
