"use client";

import { useEffect, useMemo } from "react";
import { centerCrop, makeAspectCrop } from "react-image-crop";
import { CarouselWithThumbnails } from "~/components/carousel-thumbnails";
import { editor_store } from "~/components/editor/editor-store";
import type { ThumbnailType } from "~/lib/validators";

export function ImageSelector({
  image: default_image,
  setImage,
}: {
  image: ThumbnailType | undefined;
  setImage: (date: ThumbnailType | undefined) => void;
}) {
  const images = editor_store.use.image_data();

  const thumbnails = useMemo(() => {
    return images
      .map((image) => {
        const width = image.file.width;
        const height = image.file.height;
        if (!width || !height) return undefined;

        const center = centerCrop(
          makeAspectCrop(
            {
              unit: "px",
              width,
            },
            16 / 9,
            width,
            height,
          ),
          width,
          height,
        );

        return {
          image_url: image.file.url,
          ...center,
        } satisfies ThumbnailType;
      })
      .filter((image): image is ThumbnailType => !!image);
  }, [images]);

  useEffect(() => {
    console.log("ImageSelector -> images", images);
  }, [images]);

  return (
    <CarouselWithThumbnails
      images={thumbnails}
      onImageChange={(index) => {
        const current_image = images[index];
        if (!current_image) {
          setImage(undefined);
          return;
        }

        console.log("ImageSelector -> image", {
          image: current_image,
          default_image,
        });
        // setImage(image);
      }}
    />
  );
}
