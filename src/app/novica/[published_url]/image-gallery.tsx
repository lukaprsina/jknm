"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

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
  const container_ref = useRef<HTMLDivElement>(null);
  const image_refs = useRef<(HTMLElement | null)[]>([]);
  const previous_ref = useRef<HTMLButtonElement>(null);
  const next_ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    image_refs.current = image_refs.current.slice(0, images.length);
  }, [images]);

  useEffect(() => {
    if (!emblaApi) return;

    if (first_image_src) {
      const index = images.findIndex(
        (image) => image.file.url === first_image_src,
      );

      emblaApi.scrollTo(index);
    }
  }, [emblaApi, first_image_src, images]);

  useEffect(() => {
    // console.log("default_image", default_image);

    const outside_callback = (event: MouseEvent) => {
      // console.log("outside_callback", { default_image, image_refs });
      if (!default_image) return;

      const all_refs = image_refs.current;
      if (next_ref.current && previous_ref.current) {
        all_refs.push(previous_ref.current);
        all_refs.push(next_ref.current);
      }

      const is_clicked_outside = all_refs.every(
        (ref) => ref && !ref.contains(event.target as Node),
      );

      // console.log("is_clicked_outside", { is_clicked_outside, image_refs });

      if (is_clicked_outside) {
        gallery_store.set.default_image(undefined);
        event.preventDefault();
      }
    };

    const scroll_callback = () => {
      if (!default_image) return;
      gallery_store.set.default_image(undefined);
    };

    const keypress_callback = (event: KeyboardEvent) => {
      if (!default_image) return;
      if (GALLERY_CANCEL_KEYS.includes(event.key)) {
        gallery_store.set.default_image(undefined);
        event.preventDefault();
      } else if (event.key === "ArrowLeft") {
        emblaApi?.scrollPrev();
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        emblaApi?.scrollNext();
        event.preventDefault();
      } else if (event.key === "Home") {
        emblaApi?.scrollTo(0);
        event.preventDefault();
      } else if (event.key === "End") {
        emblaApi?.scrollTo(emblaApi.slideNodes().length - 1);
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", scroll_callback);
    window.addEventListener("keydown", keypress_callback);
    window.addEventListener("mousedown", outside_callback);

    return () => {
      window.removeEventListener("wheel", scroll_callback);
      window.removeEventListener("keydown", keypress_callback);
      window.removeEventListener("mousedown", outside_callback);
    };
  }, [default_image, emblaApi]);

  return (
    <Carousel
      ref={container_ref}
      setApi={setEmblaApi}
      opts={{
        align: "center",
        duration: 0,
      }}
      className="flex h-full w-full max-w-[80%] items-center justify-center"
    >
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem
            className="flex items-center justify-center"
            key={index}
          >
            <GalleryImage
              image={image}
              ref={(ref: HTMLElement | null) => {
                image_refs.current[index] = ref;
              }}
            />
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

function GalleryImage({
  image,
  ref,
}: {
  image: EditorJSImageData;
  ref?: (ref: HTMLElement | null) => void;
}) {
  const { width, height } = useMemo(
    () => ({
      width: image.file.width ?? 1500,
      height: image.file.height ?? 1000,
    }),
    [image.file.width, image.file.height],
  );

  return (
    <figure ref={ref} className="max-h-[90vh] max-w-[90vw]">
      <div className="flex h-full w-full items-center justify-center">
        <Image
          // className="h-full w-full rounded-xl"
          className="rounded-xl"
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
