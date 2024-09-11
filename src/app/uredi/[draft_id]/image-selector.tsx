"use client";

import { useEffect } from "react";
import { CarouselWithThumbnails } from "~/components/carousel-thumbnails";
import { editor_store } from "~/components/editor/editor-store";
import type { CropType } from "~/lib/validators";

export function ImageSelector({
  image,
  setImage,
}: {
  image: CropType | undefined;
  setImage: (date: CropType | undefined) => void;
}) {
  const images = editor_store.use.image_data();

  useEffect(() => {
    console.log("ImageSelector -> images", images);
  }, [images]);

  return <CarouselWithThumbnails images={images} />;
}
