"use client";

import type { ImageProps } from "next/image";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { gallery_store } from "~/components/gallery-store";
import type { EditorJSImageData } from "~/lib/editor-utils";

interface ImageWithCaptionProps extends ImageProps {
  caption?: React.ReactNode;
}

export function ImageWithCaption({ caption, ...props }: ImageWithCaptionProps) {
  const [imageData, setImageData] = useState<EditorJSImageData | undefined>(
    undefined,
  );

  useEffect(() => {
    const props_src = props.src;
    if (typeof props_src === "string")
      throw new Error("Image src must be a StaticImport");
    if ("default" in props_src)
      throw new Error("Image src should be StaticImageData, not StaticRequire");

    const image_index = gallery_store.get
      .images()
      .findIndex((image) => image.file.url === props_src.src);
    if (image_index !== -1) return;

    setImageData({
      file: {
        url: props_src.src,
        width: props_src.width,
        height: props_src.height,
      },
      caption: caption as string,
    });
  }, [caption, props]);

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
