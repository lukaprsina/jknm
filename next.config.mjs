/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

// Plugins are passed as strings (not imported functions) so Turbopack can
// serialize them across its Rust/JS boundary -- see
// https://nextjs.org/docs/app/guides/mdx#using-plugins-with-turbopack
import createMDX from "@next/mdx";

/** @type {import("next").NextConfig} */
const config = {
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
	experimental: {
		serverActions: {
			bodySizeLimit: "100mb",
		},
	},
	// Turbopack's build-time file tracing doesn't reliably pick up sharp's
	// platform-specific native binary (it's resolved via a dynamic require at
	// runtime), so the deployed /api/media function was missing
	// libvips-cpp.so on Vercel even though it worked locally. Force it in.
	// outputFileTracingIncludes: {
	// 	"/api/media": [
	// 		"./node_modules/@img/sharp-linux-x64/**/*",
	// 		"./node_modules/@img/sharp-libvips-linux-x64/**/*",
	// 	],
	// },
	serverExternalPackages: ["sharp"],
	images: {
		loader: "custom",
		loaderFile: "./image-loader.js",
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "www.jknm.si",
				port: "",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
				port: "",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "lh3.google.com",
				port: "",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "jknm-turborepo.vercel.app",
				port: "",
				pathname: "**",
			},
			{
				protocol: "https",
				hostname: "jknm-si.vercel.app",
				port: "",
				pathname: "**",
			},
		],
	},
	// Vercel's own docs don't document automatic `noindex` on production
	// alias hostnames (`jknm-turborepo.vercel.app`, `jknm-si.vercel.app` —
	// both live above in `remotePatterns`), and they're publicly reachable.
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

const withMDX = createMDX({
	options: {
		remarkPlugins: ["remark-gfm"],
		rehypePlugins: [
			"rehype-slug",
			"@stefanprobst/rehype-extract-toc",
			"@stefanprobst/rehype-extract-toc/mdx",
		],
	},
});

export default withMDX(config);
