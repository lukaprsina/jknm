/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");
import withMDX from "@next/mdx";
/* import remarkGfm from "remark-gfm";
import createMDX from "@next/mdx";
import withSlugs from "rehype-slug";
import withToc from "@stefanprobst/rehype-extract-toc";
import withTocExport from "@stefanprobst/rehype-extract-toc/mdx"; */
// import remarkFrontmatter from "remark-frontmatter";
// import remarkMdxFrontmatter from "remark-mdx-frontmatter";

/* const mdx_rs =
  process.env.NEXT_MODE === "no-turbo"
    ? null
    : {
        mdxRs: {
          mdxType: "gfm" as const,
        },
      }; */

/** @type {import("next").NextConfig} */
const config = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  experimental: {
    // reactCompiler: false,
    // ...mdx_rs, // TODO
    mdxRs: {
      mdxType: "gfm",
    },
    serverActions: {
      bodySizeLimit: "100mb",
    },
    turbo: {},
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

/* const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [withSlugs, withToc, withTocExport],
  },
}); */

export default withMDX()(config);
// export default config;
