"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useOnClickOutside } from "usehooks-ts";

import type { CarouselApi } from "~/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "~/components/ui/carousel";
import { gallery_store } from "~/components/gallery-store";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import type { EditorJSImageData } from "~/lib/editor-utils";

const GALLERY_CANCEL_KEYS: string[] = [
  "Escape",
  "Esc",
  "Enter",
  "Return",
  // "ArrowLeft",
  // "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  // "PageUp",
  // "PageDown",
  // "Home",
  // "End",
  "Tab",
  "Backspace",
  "Delete",
];

export function ImageGallery() {
  const default_image = gallery_store.use.default_image();

  const portal = useCallback((first_image_src: string) => {
    return createPortal(
      <div
        className="fixed inset-0 z-50 h-screen w-screen bg-black/90 backdrop-blur-sm"
        /*onClick={() => {
          gallery_store.set.default_image(undefined);
        }}*/
      >
        <div className="h-full w-full">
          <div className="flex h-full min-h-[350px] w-full items-center justify-around p-10">
            <MyCarousel first_image_src={first_image_src} />
          </div>
        </div>
      </div>,
      document.body,
    );
  }, []);

  return <>{default_image ? portal(default_image.file.url) : null}</>;
}

/* useOutsideClickMultipleRefs(() => {
    gallery.clear_default_image();
  }, [carousel_ref, previous_ref, next_ref]); */

export function MyCarousel({ first_image_src }: { first_image_src?: string }) {
  const default_image = gallery_store.use.default_image();
  const images = gallery_store.use.images();
  const [emblaApi, setEmblaApi] = useState<CarouselApi>();
  const md_breakpoint = useBreakpoint("md", true);
  const carousel_ref = useRef<HTMLDivElement>(null);
  const previous_ref = useRef<HTMLButtonElement>(null);
  const next_ref = useRef<HTMLButtonElement>(null);

  const refs: RefObject<HTMLElement>[] = useMemo(
    () => [carousel_ref, previous_ref, next_ref] as RefObject<HTMLElement>[],
    [carousel_ref, previous_ref, next_ref],
  );

  useOnClickOutside(refs, () => {
    gallery_store.set.default_image(undefined);
  });

  useEffect(() => {
    if (!emblaApi) return;

    if (first_image_src) {
      const index = images.findIndex((image) => image.file.url === first_image_src);

      emblaApi.scrollTo(index);
    }
  }, [emblaApi, first_image_src, images]);



  useEffect(() => {
    if (!default_image) return;
    // console.log("default_image", default_image);

    const scroll_callback = (event: WheelEvent | TouchEvent) => {
      if (event instanceof WheelEvent) {
        gallery_store.set.default_image(undefined);
        // event.preventDefault();
      } else if (event instanceof TouchEvent) {
        const touch = event.touches[0];
        if (typeof touch?.clientY !== "undefined") {
          gallery_store.set.default_image(undefined);
          event.preventDefault();
        }
      }
    };

    const keypress_callback = (event: KeyboardEvent) => {
      if (GALLERY_CANCEL_KEYS.includes(event.key)) {
        gallery_store.set.default_image(undefined);
        event.preventDefault()
      } else if(event.key === "ArrowLeft") {
        emblaApi?.scrollPrev()
        event.preventDefault()
      } else if(event.key === "ArrowRight") {
        emblaApi?.scrollNext()
        event.preventDefault()
      } else if(event.key === "Home") {
        emblaApi?.scrollTo(0)
        event.preventDefault()
      } else if(event.key === "End") {
        emblaApi?.scrollTo(emblaApi.slideNodes().length - 1)
        event.preventDefault()
      }
    };

    window.addEventListener("wheel", scroll_callback);
    window.addEventListener("touchmove", scroll_callback);
    window.addEventListener("keydown", keypress_callback);

    return () => {
      window.removeEventListener("wheel", scroll_callback);
      window.removeEventListener("touchmove", scroll_callback);
      window.removeEventListener("keydown", keypress_callback);
    };
  }, [default_image, emblaApi]);

  return (
    <Carousel
      setApi={setEmblaApi}
      opts={{
        align: "center",
        duration: 0,
      }}
      className="flex h-full w-full max-w-[80%] items-center justify-center"
    >
      <CarouselContent ref={carousel_ref}>
        {images.map((image, index) => (
          <CarouselItem
            className="flex items-center justify-center"
            key={index}
          >
            <GalleryImage image={image} />
          </CarouselItem>
        ))}
      </CarouselContent>
      {md_breakpoint && (
        <>
          <CarouselPrevious ref={previous_ref} />
          <CarouselNext ref={next_ref} />
        </>
      )}
    </Carousel>
  );
}

function GalleryImage({ image }: { image: EditorJSImageData }) {
  const { width, height } = useMemo(
    () => ({
      width: image.file.width ?? 1500,
      height: image.file.height ?? 1000,
    }),
    [image.file.width, image.file.height],
  );

  return (
    <figure className="max-h-[90vh] max-w-[90vw]">
      <div className="flex h-full max-h-[90vh] w-full max-w-[90vw] items-center justify-center">
        <Image
          className="rounded-xl object-fit w-full h-full"
          src={image.file.url}
          alt={image.caption}
          // sizes="(max-width: 1500px) 100vw, 1500px"
          width={width}
          height={height}
        />
      </div>
      {image.caption && (
        <figcaption className="mt-2 w-full rounded-xl text-white">
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}
