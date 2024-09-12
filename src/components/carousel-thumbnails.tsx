// https://www.reddit.com/r/nextjs/comments/1cgktu9/shadcnui_image_carousel_with_thumbnail_images/
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import type { CarouselApi } from "./ui/carousel";
import { Carousel, CarouselContent, CarouselItem } from "./ui/carousel";
import Image from "next/image";
import type { ThumbnailType } from "~/lib/validators";
import ReactCrop, { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface GalleryProps {
  images: ThumbnailType[];
  onImageChange: (index: number) => void;
}

export function CarouselWithThumbnails({
  images,
  onImageChange,
}: GalleryProps) {
  const [mainApi, setMainApi] = useState<CarouselApi>();
  const [thumbnailApi, setThumbnailApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [crop, setCrop] = useState<Crop>();

  useEffect(() => {
    onImageChange(current);
  }, [current, onImageChange]);

  const mainImages = useMemo(
    () =>
      images.map((image, index) => (
        <CarouselItem key={index} className="relative aspect-square w-full">
          <ReactCrop
            crop={crop}
            onChange={(pixelCrop, percentCrop) => {
              console.log("crop", pixelCrop, percentCrop);
              setCrop(pixelCrop);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.image_url}
              alt={`Carousel Main Image ${index + 1}`}
              style={{ objectFit: "cover" }}
            />
          </ReactCrop>
        </CarouselItem>
      )),
    [crop, images],
  );

  const handleClick = useCallback(
    (index: number) => {
      if (!mainApi || !thumbnailApi) {
        return;
      }
      thumbnailApi.scrollTo(index);
      mainApi.scrollTo(index);
      setCurrent(index);
    },
    [mainApi, thumbnailApi],
  );

  const thumbnailImages = useMemo(
    () =>
      images.map((image, index) => (
        <CarouselItem
          key={index}
          className="relative aspect-square w-full basis-1/4"
          onClick={() => handleClick(index)}
        >
          <Image
            className={`${index === current ? "border-2" : ""}`}
            src={image.image_url}
            fill
            alt={`Carousel Thumbnail Image ${index + 1}`}
            style={{ objectFit: "cover" }}
          />
        </CarouselItem>
      )),
    [images, current, handleClick],
  );

  useEffect(() => {
    if (!mainApi || !thumbnailApi) {
      return;
    }

    const handleTopSelect = () => {
      const selected = mainApi.selectedScrollSnap();
      setCurrent(selected);
      thumbnailApi.scrollTo(selected);
    };

    const handleBottomSelect = () => {
      const selected = thumbnailApi.selectedScrollSnap();
      setCurrent(selected);
      mainApi.scrollTo(selected);
    };

    mainApi.on("select", handleTopSelect);
    thumbnailApi.on("select", handleBottomSelect);

    return () => {
      mainApi.off("select", handleTopSelect);
      thumbnailApi.off("select", handleBottomSelect);
    };
  }, [mainApi, thumbnailApi]);

  return (
    <div className="w-96 max-w-xl sm:w-auto">
      <Carousel setApi={setMainApi}>
        <CarouselContent className="m-1">{mainImages}</CarouselContent>
      </Carousel>
      <Carousel setApi={setThumbnailApi}>
        <CarouselContent className="m-1">{thumbnailImages}</CarouselContent>
      </Carousel>
    </div>
  );
}
