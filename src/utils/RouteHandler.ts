import type { Env } from "../index.ts";

export type Handler = (ctx: RouteHandler) => Promise<Response> | Response;

/**
 * The route handler class to handle requests in a more organized way
 */
class RouteHandler {
	/**
	 * The endpoints that the route handler will handle (Do not modify directly)
	 * @private
	 */
	private _endpoints: Map<
		string,
		{
			handler: Handler;
			authRequired: boolean;
		}
	> = new Map();

	public request!: Request;

	public env!: Env;

	public ctx!: ExecutionContext;

	/**
	 * Appends a new endpoint to the route handler
	 * @param endpoint The endpoint to append (e.g. /, /home, /about, etc.)
	 * @param handler The logic to execute when the endpoint is hit
	 * @param authRequired Whether or not the endpoint requires authentication
	 * @returns This just reutrns the route handler so you can chain the append method
	 */
	public append(endpoint: string, handler: Handler, authRequired = false): RouteHandler {
		this._endpoints.set(endpoint, {
			authRequired,
			handler,
		});

		return this;
	}

	/**
	 * This is more of a internal method, but exposing it in-case you need to handle promises in a specific way somewhere else
	 * @param promise The promise to handle
	 * @returns The first value is the fulfilled value of the promise, or null if the promise was rejected. The second value is the rejection reason, or null if the promise was fulfilled.
	 */
	public async promiseHandler<Value>(promise: Promise<Value> | Value): Promise<[Value | null, Error | null]> {
		try {
			const value = await promise;
			return [value, null];
		} catch (e) {
			return [null, e as Error];
		}
	}

	/**
	 * Handle the actual request
	 * @param request The request object
	 * @param env The environment object
	 * @param ctx The execution context object
	 * @returns Returns the response object
	 */
	public async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		this.request = request;
		this.env = env;
		this.ctx = ctx;

		const url = new URL(request.url);
		const path = url.pathname;

		const handler = this._endpoints.get(path);

		if (!handler) {
			console.error(`No handler found for ${path}`);

			return new Response("Not Found", { status: 404 });
		}

		if (handler.authRequired && request.headers.get("Authorization") !== env.authHeader && process.env.NODE_ENV !== "development") {
			console.error(`Unauthorized request to ${path}`);

			return new Response("Unauthorized", { status: 401 });
		}

		const [res, error] = await this.promiseHandler(handler.handler(this));

		if (error) {
			console.error(error);

			return new Response("Internal Server Error", { status: 500 });
		}

		if (!(res instanceof Response)) {
			console.error("Handler did not return a response object");

			return new Response("Internal Server Error", { status: 500 });
		}

		return res;
	}
}

export default RouteHandler;
