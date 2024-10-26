"use client";

import type { ImageProps } from "next/image";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { gallery_store } from "~/components/gallery-store";
import type { EditorJSImageData } from "~/lib/editor-utils";

export interface ImageSize {
  url: string;
  width: number;
  height: number;
}

interface ImageWithCaptionProps extends ImageProps {
  caption?: React.ReactNode;
  image_sizes: ImageSize[];
}

export function ImageWithCaption({
  caption,
  image_sizes,
  ...props
}: ImageWithCaptionProps) {
  const [imageData, setImageData] = useState<EditorJSImageData | undefined>(
    undefined,
  );

  useEffect(() => {
    const props_src = props.src;
    if (typeof props_src !== "string")
      throw new Error("Image src should be string");

    const image_size = image_sizes.find((size) => size.url === props_src);
    if (!image_size) throw new Error("Image size not found");

    setImageData({
      file: image_size,
      caption: caption as string,
    });
  }, [caption, image_sizes, props]);

  useEffect(() => {
    if (!imageData) return;
    gallery_store.set.add_image(imageData);
  }, [imageData]);

  return (
    <figure>
      <Image
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
