"use client";

import type { ImageProps } from "next/image";
import Image from "next/image";
import { gallery_store } from "~/components/gallery-store";
import image_sizes from "artifacts/image_sizes.json";
import { env } from "~/env";
import { useState, useEffect } from "react";
import { type EditorJSImageData } from "~/lib/editor-utils";

interface ImageWithCaptionProps extends ImageProps {
  caption?: React.ReactNode;
}

export function ImageWithCaption({
  src,
  caption,
  ...props
}: ImageWithCaptionProps) {
  const [imageData, setImageData] = useState<EditorJSImageData | undefined>(
    undefined,
  );

  useEffect(() => {
    if (typeof src !== "string") throw new Error("Image src should be string");

    const new_src = `https://cdn-content.${env.NEXT_PUBLIC_SITE_DOMAIN}/${src}`;
    const image_size = image_sizes.find((size) => size.path === src);
    if (!image_size) throw new Error("Image size not found");

    setImageData({
      file: {
        url: new_src,
        width: image_size.size.width,
        height: image_size.size.height,
      },
      caption: caption as string,
    });
  }, [caption, src]);

  useEffect(() => {
    if (!imageData) return;
    gallery_store.set.add_image(imageData);
  }, [imageData]);

  if (typeof src !== "string") throw new Error("Image src should be string");
  const image_size = image_sizes.find((size) => size.path === src);
  if (!image_size) throw new Error(`Image size not found for ${src}`);

  const new_src = `https://cdn-content.${env.NEXT_PUBLIC_SITE_DOMAIN}/${src}`;

  return (
    <figure>
      {/* TODO */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image
        src={new_src}
        width={image_size.size.width}
        height={image_size.size.height}
        {...props}
        onClick={() => {
          if (!imageData) return;
          gallery_store.set.default_image(imageData);
        }}
      />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
