import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		environment: "node",
		exclude: ["**/node_modules/**", "vendor/**"],
		// Populates `process.env` for every test worker from `.env`/`.env.local`
		// (the "" third argument disables Vite's default `VITE_`-prefix filter,
		// since `~/env` validates the app's own unprefixed and `NEXT_PUBLIC_`
		// vars). Needed as of #31 step 4: oRPC procedure smoke tests import
		// `~/server/article/lifecycle`, which runs `~/env`'s validation at
		// import time — previously no test transitively imported it at runtime.
		env: loadEnv("test", process.cwd(), ""),
	},
});
