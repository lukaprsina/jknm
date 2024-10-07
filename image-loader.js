"use client";

// @ts-expect-error meh
export default function myImageLoader({ src }) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return src;
}
