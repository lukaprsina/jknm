import type { Session } from "~/server/auth";

/**
 * Initial context every procedure requires. `session` is resolved once by
 * the caller (the RSC direct client, the HTTP route handler, or a test) via
 * `getServerAuthSession` — the one call site allowed to name better-auth/
 * `next/headers`, per ADR-0002. Procedures and their middleware only ever see
 * the resolved value, which is what keeps them callable from tests with no
 * Next.js request scope.
 */
export interface ORPCContext {
	session: Session | null;
}
