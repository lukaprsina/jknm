/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  images: {
    loader: "custom",
    loaderFile: "./image-loader.js",
    unoptimized: true,
    remotePatterns: [
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
    ],
  },

  experimental: {
    // reactCompiler: false,
    serverActions: {
      // TODO
      bodySizeLimit: "100mb",
    },
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },
};

export default config;
