"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Crop } from "react-image-crop";
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
  setImage: (image: ThumbnailType) => void;
}) {
  const images = editor_store.use.image_data();
  const [crop, setCrop] = useState<Crop>();

  const crops = useMemo(() => {
    const crops_maybe = images.map((image) => {
      const width = image.file.width;
      const height = image.file.height;
      if (!width || !height) return;

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

      const crop = {
        image_url: image.file.url,
        ...center,
      } as ThumbnailType;

      return crop;
    });

    return crops_maybe.filter((crop): crop is ThumbnailType => !!crop);
  }, [images]);

  const current_crop = useMemo(
    () => crops.find((crop) => crop.image_url === selected_image?.image_url),
    [crops, selected_image],
  );

  useEffect(() => {
    setCrop(current_crop);
  }, [current_crop]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;

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

    setCrop(crop);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {crops.map((crop, index) => (
          <Card
            key={crop.image_url}
            onClick={() => {
              setImage(crop);
            }}
            className={cn(
              "box-border flex cursor-pointer items-center justify-center border-2 p-2",
              selected_image?.image_url === crop.image_url && "border-blue-500",
            )}
          >
            <Image
              src={crop.image_url}
              alt={`Izbira slike #${index}`}
              width={crop.width}
              height={crop.height}
              className="max-h-[300px] max-w-[300px]"
            />
          </Card>
        ))}
      </div>
      {selected_image?.image_url && (
        <ReactCrop
          crop={crop}
          onChange={(pixelCrop) => {
            console.log("ImageSelector -> crop", pixelCrop);
            setCrop(pixelCrop);
            // setImage(pixelCrop);
          }}
          aspect={16 / 9}
          minWidth={400}
          minHeight={100}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected_image.image_url} onLoad={onImageLoad} />
        </ReactCrop>
      )}
    </div>
  );
}
