import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Native replacement for the `vite-tsconfig-paths` plugin (Vite added
		// first-party support for this). Reads `paths` from the root
		// `tsconfig.json` only — unlike the plugin's default crawl, it never
		// walks the vendored `fumadocs`/`better-auth`/`radix-ui-primitives` git
		// submodules under `vendor/` (see AGENTS.md), so there's nothing there
		// to fail parsing.
		tsconfigPaths: true,
	},
	test: {
		environment: "node",
		exclude: ["**/node_modules/**", "vendor/**"],
		// `@orpc/next`'s dist imports `next/navigation` (no extension), which
		// Next's own bundler resolves leniently but plain Node/Vite ESM
		// resolution doesn't (`next` ships no `exports` map). Left external
		// (the default), that import is resolved natively and fails outright;
		// inlining routes it through Vite's resolver — lenient enough to find
		// `navigation.js` — and lets tests mock `next/navigation` besides.
		server: {
			deps: {
				inline: [/@orpc\/next/],
			},
		},
		// Populates `process.env` for every test worker from `.env`/`.env.local`
		// (the "" third argument disables Vite's default `VITE_`-prefix filter,
		// since `~/env` validates the app's own unprefixed and `NEXT_PUBLIC_`
		// vars). Needed as of #31 step 4: oRPC procedure smoke tests import
		// `~/server/article/lifecycle`, which runs `~/env`'s validation at
		// import time — previously no test transitively imported it at runtime.
		env: loadEnv("test", process.cwd(), ""),
	},
});
