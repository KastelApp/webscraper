/**
 * This is more of a internal method, but exposing it in-case you need to handle promises in a specific way somewhere else
 * @param promise The promise to handle
 * @returns The first value is the fulfilled value of the promise, or null if the promise was rejected. The second value is the rejection reason, or null if the promise was fulfilled.
 */
const promiseHandler = async <Value>(promise: Promise<Value> | Value): Promise<[Value | null, Error | null]> => {
	try {
		const value = await promise;
		return [value, null];
	} catch (e) {
		return [null, e as Error];
	}
};

export default promiseHandler;
