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
