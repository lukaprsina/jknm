"use client";

import { createAuthClient } from "better-auth/react";

/**
 * The only place client code names the auth library. `baseURL` is omitted
 * deliberately — the app is always same-origin with its own route handler, so
 * there is nothing for a public env var to configure.
 *
 * Intentionally no `useSession` / session provider is re-exported: sessions are
 * read in Server Components and passed down as props (#32).
 */
const auth_client = createAuthClient();

export async function sign_in_with_google({
	callback_url = "/",
}: {
	callback_url?: string;
} = {}) {
	await auth_client.signIn.social({
		provider: "google",
		callbackURL: callback_url,
	});
}

export async function sign_out() {
	await auth_client.signOut();
}
