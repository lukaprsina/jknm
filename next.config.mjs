/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");
import remarkGfm from "remark-gfm";
import createMDX from "@next/mdx";
import withSlugs from "rehype-slug";
import withToc from "@stefanprobst/rehype-extract-toc";
import withTocExport from "@stefanprobst/rehype-extract-toc/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";

const mdx_rs =
  process.env.NEXT_MODE === "no-turbo"
    ? null
    : {
        mdxRs: {
          mdxType: "gfm",
        },
      };

/** @type {import("next").NextConfig} */
const config = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  images: {
    loader: "custom",
    loaderFile: "./image-loader.js",
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "unsplash.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "jamarski-klub-novo-mesto.s3.eu-central-1.amazonaws.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "jknm.s3.eu-central-1.amazonaws.com",
        port: "",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "jknm-draft.s3.eu-central-1.amazonaws.com",
        port: "",
        pathname: "**",
      },
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

  experimental: {
    // reactCompiler: false,
    ...mdx_rs,
    serverActions: {
      // TODO
      bodySizeLimit: "100mb",
    },
    turbo: {
      /*rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },*/
    },
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [withSlugs, withToc, withTocExport],
  },
});

export default withMDX(config);
