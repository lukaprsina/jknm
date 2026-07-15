import type { Session } from "next-auth";
import type { z } from "zod";
import { getServerAuthSession } from "../auth";

/**
 * Shared guard for the lifecycle/new-article server actions: requires a
 * session, then validates `input` against `validator`. Throws "Unauthorized"
 * or the zod error message on failure; otherwise returns the session and the
 * parsed (not raw) input.
 */
export async function run_authorized_mutation<Schema extends z.ZodTypeAny>(
	validator: Schema,
	input: z.input<Schema>,
): Promise<{ session: Session; input: z.output<Schema> }> {
	const session = await getServerAuthSession();
	if (!session) throw new Error("Unauthorized");

	const validated = validator.safeParse(input);
	if (!validated.success) throw new Error(validated.error.message);

	return { session, input: validated.data };
}
