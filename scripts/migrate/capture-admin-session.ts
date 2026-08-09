/**
 * One-time interactive login capture for the static-page migration scripts
 * (#36). Google OAuth can't be scripted (and shouldn't be — no bot should
 * hold real club credentials), so this opens a real, visible browser, waits
 * for a human to click through Google sign-in by hand, then saves the
 * resulting cookies to `scripts/.cache/admin-storage-state.json`
 * (gitignored). `migrate-static-page.ts` loads that file instead of signing
 * in itself.
 *
 * Re-run this whenever the saved session expires (the migration script will
 * fail with a redirect back to /prijava when that happens).
 *
 * Usage:
 *   dotenv -e .env.local -e .env.staging --override -- bun run scripts/migrate/capture-admin-session.ts
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { env } from "~/env.js";

export const STORAGE_STATE_PATH = path.join(
	import.meta.dirname,
	"..",
	".cache",
	"admin-storage-state.json",
);

async function main() {
	await mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.goto(new URL("/prijava", env.BETTER_AUTH_URL).toString());

	console.log(
		"\nComplete the Google sign-in in the opened browser window.\n" +
			"Waiting for it to land on an authenticated page...",
	);

	// Any post-sign-in page works as the "done" signal — /prijava itself
	// redirects away once a session cookie exists.
	await page.waitForURL((url) => !url.pathname.startsWith("/prijava"), {
		timeout: 5 * 60 * 1000,
	});

	await context.storageState({ path: STORAGE_STATE_PATH });
	console.log(`Saved session to ${STORAGE_STATE_PATH}`);

	await browser.close();
}

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
