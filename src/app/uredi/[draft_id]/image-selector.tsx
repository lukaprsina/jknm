"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import { editor_store } from "~/components/editor/editor-store";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { ThumbnailType } from "~/lib/validators";
import "react-image-crop/dist/ReactCrop.css";

export function ImageSelector({
  image: selected_image,
  setImage,
}: {
  image: ThumbnailType | undefined;
  setImage: (image: ThumbnailType | undefined) => void;
}) {
  const images = editor_store.use.image_data();
  const [imageIndex, setImageIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    console.log("ImageSelector -> selected_image", selected_image);
  }, [selected_image]);

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: width, naturalHeight: height } = event.currentTarget;

    const crop = centerCrop(
      makeAspectCrop(
        {
          // You don't need to pass a complete crop into
          // makeAspectCrop or centerCrop.
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
    if (typeof imageIndex === "undefined" || !images[imageIndex]?.file.url)
      return;

    setImage({
      image_url: images[imageIndex].file.url,
      ...crop,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <Card
            key={image.file.url}
            onClick={() => {
              setImageIndex(index);
              setImage(undefined);
            }}
            className={cn(
              "box-border flex cursor-pointer items-center justify-center border-2 p-2",
              selected_image?.image_url === image.file.url && "border-blue-500",
            )}
          >
            <Image
              src={image.file.url}
              alt={`Izbira slike #${index}`}
              width={image.file.width}
              height={image.file.height}
              className="max-h-[300px] max-w-[300px]"
            />
          </Card>
        ))}
      </div>
      {typeof imageIndex !== "undefined" && images[imageIndex]?.file.url && (
        // TODO
        <div style={{ width: `${images[imageIndex].file.width}px` }}>
          <ReactCrop
            crop={selected_image}
            onChange={(pixelCrop) => {
              if (!images[imageIndex]?.file.url) return;

              console.log("ImageSelector -> crop", pixelCrop);
              // setCrop(pixelCrop);
              setImage({
                image_url: images[imageIndex].file.url,
                ...pixelCrop,
              });
            }}
            aspect={16 / 9}
            //   minWidth={400}
            ruleOfThirds
            minHeight={100}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[imageIndex].file.url}
              onLoad={(event) => onImageLoad(event)}
              width={images[imageIndex].file.width}
              height={images[imageIndex].file.height}
            />
          </ReactCrop>
        </div>
      )}
    </div>
  );
}
