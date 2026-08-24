import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { GoogleProfile } from "better-auth/social-providers";
import { decodeJwt } from "jose";
import { headers } from "next/headers";
import { cache } from "react";

import { env } from "~/env";
import { DEPLOYMENT_ORIGIN } from "~/lib/domains";
import { db } from "~/server/db";
import { accounts, sessions, users, verification } from "~/server/db/schema";
import { to_app_session } from "./session-shape";
import { is_allowed_sign_in } from "./sign-in-gate";

export type { Session } from "./session-shape";

export const auth = betterAuth({
	baseURL: DEPLOYMENT_ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	// Extra origins allowed to complete a Google sign-in against this
	// deployment during the domain transition — see src/lib/domains.ts.
	// jknm.org: bought and pointed at Vercel, not yet the live app origin.
	// jknm-si.vercel.app: today's DEPLOYMENT_ORIGIN, kept trusted so it
	// doesn't break once DEPLOYMENT_ORIGIN is flipped to jknm.si at cutover.
	trustedOrigins: ["https://jknm.org", "https://jknm-si.vercel.app"],
	database: drizzleAdapter(db, {
		provider: "pg",
		// The adapter looks tables up by better-auth's model names, which are not
		// the names this schema exports them under.
		schema: {
			user: users,
			session: sessions,
			account: accounts,
			verification,
		},
	}),
	account: {
		accountLinking: {
			enabled: true,
			// Deliberate redundancy for the NextAuth migration (#32): the `account`
			// rows were dropped, so every returning editor re-links by email on
			// their next sign-in, and orphaned authorship is the failure we cannot
			// afford. Safe because `is_allowed_sign_in` below has already rejected
			// anything that is not a verified @jknm.si Google identity.
			trustedProviders: ["google"],
		},
	},
	socialProviders: {
		google: {
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			/**
			 * The sign-in gate. better-auth has no equivalent of NextAuth's `signIn`
			 * callback: `databaseHooks.user.create.before` fires only for new users
			 * (every returning editor would walk straight past it), and the docs
			 * never show the raw `email_verified` claim being reachable from
			 * `hooks.before` on the OAuth callback path. `getUserInfo` is the one
			 * documented layer that sees the provider profile and can refuse.
			 *
			 * This mirrors the provider's built-in implementation, which it fully
			 * replaces — including its `hd` check, which is why `hd` is deliberately
			 * not configured above. One gate, one test surface.
			 */
			getUserInfo: async (token) => {
				if (!token.idToken) return null;
				const profile = decodeJwt(token.idToken) as GoogleProfile;

				if (
					!is_allowed_sign_in({
						provider: "google",
						email: profile.email,
						email_verified: profile.email_verified,
					})
				) {
					return null;
				}

				return {
					user: {
						name: profile.name,
						email: profile.email,
						image: profile.picture,
						emailVerified: profile.email_verified,
					},
					data: profile,
				};
			},
		},
	},
});

/**
 * The app's only server-side session read. Adapts better-auth's
 * `{ session, user }` into the `{ user, expires }` shape every call site was
 * already written against — see `./session-shape.ts`.
 *
 * Memoized per request with React `cache`: since #31 step 3 the shell renders
 * the session read twice (once per header breakpoint), and
 * `/novica/[published_url]` reads it in both `generateMetadata` and the page
 * body. Without this each of those is a separate session-table query.
 *
 * The memoization is an optimization only: no caller depends on it, and route
 * handlers and server actions are correct either way, so whether `cache`
 * actually dedupes outside a render scope is deliberately not relied upon.
 */
export const getServerAuthSession = cache(
	async function getServerAuthSession() {
		return to_app_session(
			await auth.api.getSession({ headers: await headers() }),
		);
	},
);
