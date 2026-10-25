import type { ServerFunction } from "@orpc/next";

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
	if (error)
		throw error instanceof Error
			? error
			: new Error("Non-Error thrown from server function", { cause: error });
	return data as T;
}

/**
 * Input type of an `.actionable()` server function. `Parameters<>` can't be
 * used: `ServerFunction` is overloaded (plain call + `useActionState` shape)
 * and `Parameters` resolves the last overload, yielding `unknown`.
 */
export type ServerFunctionInput<F> =
	F extends ServerFunction<infer TInput, infer _O, infer _E> ? TInput : never;
