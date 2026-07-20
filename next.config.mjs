/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

// @next/mdx's loader takes plugin functions (remarkGfm, rehype-slug, ...) as
// options, which Turbopack can't serialize across its Rust/JS boundary --
// hence `--webpack` on the dev/build scripts in package.json. Compile speed
// isn't a concern here (five small static pages).
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";
import withSlugs from "rehype-slug";
import withToc from "@stefanprobst/rehype-extract-toc";
import withTocExport from "@stefanprobst/rehype-extract-toc/mdx";

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
		remarkPlugins: [remarkGfm],
		rehypePlugins: [withSlugs, withToc, withTocExport],
	},
});

export default withMDX(config);
