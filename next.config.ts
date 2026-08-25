/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import type { NextConfig } from "next";

const config: NextConfig = {
	allowedDevOrigins: ["jknm.local", "*.jknm.local"], // portless
	experimental: {
		serverActions: {
			bodySizeLimit: "100mb",
		},
	},
	// Turbopack's build-time file tracing doesn't reliably pick up sharp's
	// platform-specific native binary (it's resolved via a dynamic require at
	// runtime), so the deployed /api/media function was missing
	// libvips-cpp.so on Vercel even though it worked locally. Force it in.
	// Remove in Next 16.3+. lovell/sharp #4567
	outputFileTracingIncludes: {
		"/api/media": [
			"./node_modules/@img/sharp-linux-x64/**/*",
			"./node_modules/@img/sharp-libvips-linux-x64/**/*",
		],
	},
	images: {
		unoptimized: true,
	},
	// Vercel's own docs don't document automatic `noindex` on production
	// alias hostnames (`jknm-turborepo.vercel.app`, `jknm-si.vercel.app`),
	// and they're publicly reachable.
	// Left unindexed, they'd otherwise be indexable duplicate-content copies
	// of every page on `www.jknm.si`.
	async headers() {
		return [
			{
				source: "/:path*",
				has: [{ type: "host", value: "(?<host>.*\\.vercel\\.app)" }],
				headers: [{ key: "X-Robots-Tag", value: "noindex" }],
			},
		];
	},
};

export default config;
