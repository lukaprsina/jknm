"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import { editor_store } from "~/components/editor/editor-store";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { ThumbnailType } from "~/lib/validators";
import "react-image-crop/dist/ReactCrop.css";
import type { EditorJSImageData } from "~/lib/editor-utils";
import { PlusIcon } from "lucide-react";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Button } from "~/components/ui/button";
import {
  canvas_preview,
  useDebounceEffect,
} from "~/components/editor/image-crop";

export function ImageSelector({
  image: selectedImage,
  setImage: setSelectedImage,
}: {
  image: ThumbnailType | undefined;
  setImage: (image: ThumbnailType | undefined) => void;
}) {
  const store_images = editor_store.use.image_data();
  const input_ref = useRef<HTMLInputElement>(null);
  const preview_canvas_ref = useRef<HTMLCanvasElement>(null);
  const image_ref = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<ThumbnailType>();
  const download_anchor_ref = useRef<HTMLAnchorElement>(null);
  const blob_url_ref = useRef<string | null>(null);

  const [uploadedImage, setUploadedImage] = useState<
    EditorJSImageData | undefined
  >(undefined);

  const images = useMemo(() => {
    const temp = [...store_images];
    if (uploadedImage) temp.push(uploadedImage);
    return temp;
  }, [store_images, uploadedImage]);

  const [imageIndex, setImageIndex] = useState<number | undefined>(undefined);

  const handle_image_load = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: width, naturalHeight: height } =
        event.currentTarget;

      const crop = centerCrop(
        makeAspectCrop(
          {
            unit: "%",
            width: 100,
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

      setCrop({
        image_url: images[imageIndex].file.url,
        ...crop,
      });
    },
    [imageIndex, images, setCrop],
  );

  const upload_thumbnail = useCallback(async () => {
    const image = image_ref.current;
    const preview_canvas = preview_canvas_ref.current;
    if (!image || !preview_canvas || !selectedImage) {
      const test = JSON.stringify({
        image: !!image,
        preview_canvas: !!preview_canvas,
        completedCrop: !!selectedImage,
      });

      alert(test);
      console.error("Crop canvas does not exist");
      return;
    }

    // This will size relative to the uploaded image
    // size. If you want to size according to what they
    // are looking at on screen, remove scaleX + scaleY
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const offscreen = new OffscreenCanvas(
      selectedImage.width * scaleX,
      selectedImage.height * scaleY,
    );

    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      //   throw new Error("No 2d context");

      console.error("No 2d context");
      return;
    }

    ctx.drawImage(
      preview_canvas,
      0,
      0,
      preview_canvas.width,
      preview_canvas.height,
      0,
      0,
      offscreen.width,
      offscreen.height,
    );
    /* const worker = new Worker(getWorkerURL());
    worker.onmessage = (e) => console.log(e.data);

    function getWorkerURL() {
      return URL.createObjectURL(new Blob([worker_script.textContent]));
    } */
    // You might want { type: "image/jpeg", quality: <0 to 1> } to
    // reduce image size
    // const test = preview_canvas.toDataURL("image/png");
    // const img = ctx.toDataURL("image/png");
    /* const blob = await offscreen.convertToBlob({
      type: "image/png",
    }); */

    const test = preview_canvas.toDataURL("image/png");

    console.log("blob", test);
    return;
    if (blob_url_ref.current) {
      URL.revokeObjectURL(blob_url_ref.current);
    }

    blob_url_ref.current = URL.createObjectURL(blob);

    if (download_anchor_ref.current) {
      download_anchor_ref.current.href = blob_url_ref.current;
      //   download_anchor_ref.current.click();
    }
  }, [selectedImage]);

  useEffect(() => {
    console.log("ImageSelector -> images", {
      images,
      completedCrop: selectedImage,
    });
  }, [images, selectedImage]);

  useDebounceEffect(
    () => {
      if (
        selectedImage?.width &&
        selectedImage.height &&
        image_ref.current &&
        preview_canvas_ref.current
      ) {
        // We use canvasPreview as it's much faster than imgPreview.
        canvas_preview(
          image_ref.current,
          preview_canvas_ref.current,
          selectedImage,
        );
      } else {
        console.log("ImageSelector -> completedCrop", {
          "completedCrop?.width": selectedImage?.width,
          "completedCrop.height": selectedImage?.height,
          "image_ref.current": image_ref.current,
          "preview_canvas_ref.current": preview_canvas_ref.current,
        });
      }
    },
    100,
    [selectedImage],
  );

  return (
    <>
      <input
        type="file"
        className="hidden"
        accept="image/*"
        ref={input_ref}
        onChange={(event) => {
          const files = event.target.files;
          const file = files?.item(0);
          console.log("input onChange event", file);
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new window.Image();
            img.onload = () => {
              const { width, height } = img;
              setUploadedImage({
                file: {
                  url: URL.createObjectURL(file),
                  width,
                  height,
                },
                caption: "",
              });
            };
            img.src = e.target?.result as string;
          };
          reader.readAsDataURL(file);

          setUploadedImage({
            file: {
              url: URL.createObjectURL(file),
              width: 1500,
              height: 1000,
            },
            caption: "",
          });
        }}
      />
      {!!selectedImage && (
        <canvas
          ref={preview_canvas_ref}
          /*  className="hidden" */ style={{
            border: "1px solid black",
            objectFit: "contain",
            width: selectedImage.width,
            height: selectedImage.height,
          }}
        />
      )}
      <a href="#hidden" ref={download_anchor_ref} download className="hidden" />
      <Button
        type="button"
        onClick={async () => {
          try {
            await upload_thumbnail();
          } catch (e: unknown) {
            if (e instanceof Error) {
              alert("Error uploading thumbnail" + e.message);
            }
          }
        }}
      >
        Naloži
      </Button>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <Card
              key={image.file.url}
              onClick={() => {
                setImageIndex(index);
                setCrop(undefined);
              }}
              className={cn(
                "box-border flex cursor-pointer items-center justify-center border-2 p-2",
                crop?.image_url === image.file.url && "border-blue-500",
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
          <Card
            onClick={() => {
              if (!input_ref.current) return;
              input_ref.current.value = "";
              input_ref.current.click();
            }}
            className="box-border flex cursor-pointer items-center justify-center border-2 p-2"
          >
            <div className="w-[300px]">
              <AspectRatio
                ratio={16 / 9}
                className="flex h-full items-center justify-center"
              >
                <PlusIcon />
              </AspectRatio>
            </div>
          </Card>
        </div>
        {typeof imageIndex !== "undefined" && images[imageIndex]?.file.url && (
          <div
            className="max-w-[500px]"
            style={{ width: `${images[imageIndex].file.width}px` }}
          >
            <ReactCrop
              onComplete={(c) => setSelectedImage(c)}
              crop={crop}
              onChange={(pixelCrop) => {
                if (!images[imageIndex]?.file.url) return;

                // console.log("ImageSelector -> crop", pixelCrop);
                setCrop({
                  image_url: images[imageIndex].file.url,
                  ...pixelCrop,
                });
              }}
              aspect={16 / 9}
              ruleOfThirds
              minHeight={100}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={image_ref}
                src={images[imageIndex].file.url}
                onLoad={(event) => handle_image_load(event)}
              />
            </ReactCrop>
          </div>
        )}
      </div>
    </>
  );
}
