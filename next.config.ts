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
	// Preserves the 2008-site's raw asset URLs (`jknm.si/media/...`,
	// `jknm.si/img/...`) byte-identical at the same paths post-cutover, so
	// existing Google Images / hotlink / bookmark links keep resolving with
	// no redirect needed — the URL never changes from Google's perspective.
	// Backed by the `jknm-legacy` B2 bucket (`b2 sync` from the 2008-site
	// filesystem snapshot), not `MEDIA_CDN_ORIGIN` — this is the old static
	// site's asset tree, unrelated to the EditorJS media pipeline.
	async rewrites() {
		return [
			{
				source: "/media/:path*",
				destination: "https://f003.backblazeb2.com/file/jknm-legacy/media/:path*",
			},
			{
				source: "/img/:path*",
				destination: "https://f003.backblazeb2.com/file/jknm-legacy/img/:path*",
			},
		];
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
