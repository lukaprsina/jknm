/**
 * `.actionable()` procedures (the `procedures.ts` files under
 * `~/server/orpc`) resolve to a `[error, data]` tuple instead of throwing
 * (oRPC/Next's server-function convention) — TanStack Query's `useMutation`
 * expects a `mutationFn` that throws on failure, so every call site unwraps
 * through this first.
 */
export async function unwrap_server_function<T>(
	call: Promise<readonly [error: unknown, data: T | undefined]>,
): Promise<T> {
	const [error, data] = await call;
	if (error) throw error;
	return data as T;
}
