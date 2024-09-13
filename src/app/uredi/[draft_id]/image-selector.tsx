"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Crop } from "react-image-crop";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import { editor_store } from "~/components/editor/editor-store";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { ThumbnailType } from "~/lib/validators";
import "react-image-crop/dist/ReactCrop.css";
import type { EditorJSImageData } from "~/lib/editor-utils";
import { PlusIcon } from "lucide-react";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { upload_image_by_file } from "~/components/aws-s3/upload-file";
import { get_s3_draft_directory } from "~/lib/article-utils";

/* 
const images = useMemo(() => {
    const temp = [...store_images];
    if (uploadedImage) temp.push(uploadedImage);
    console.log("a", {
      store_images,
      uploadedImage,
      temp,
    });
    return temp;
  }, [store_images, uploadedImage]);
*/

export function ImageSelector({
  image: formImage,
  setImage: setFormImage,
}: {
  image: ThumbnailType | undefined;
  setImage: (image: ThumbnailType | undefined) => void;
}) {
  const store_images = editor_store.use.image_data();
  const input_ref = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState<Crop>();

  const [uploadedImage, setUploadedImage] = useState<
    EditorJSImageData | undefined
  >(undefined);

  const images = useMemo(() => {
    const temp = [...store_images];
    if (uploadedImage) temp.push(uploadedImage);
    console.log("a", {
      store_images,
      uploadedImage,
      temp,
    });
    return temp;
  }, [store_images, uploadedImage]);

  const [imageIndex, setImageIndex] = useState<number | undefined>(undefined);

  /* useEffect(() => {
    const possible_index = images.findIndex(
      (image) => image.file.url === formImage?.image_url,
    );

    if (possible_index === -1) {
      if (!uploadedImage && formImage?.image_url) {
        setUploadedImage({
          file: {
            url: formImage.image_url,
            width: formImage.width,
            height: formImage.height,
          },
          caption: "",
        });
        setImageIndex(images.length);
      }
    } else {
      setImageIndex(possible_index);
    }
  }, [formImage, images, uploadedImage]); */

  const handle_image_load = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: width, naturalHeight: height } =
        event.currentTarget;

      const current_crop = centerCrop(
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

      setCrop(current_crop);
    },
    [imageIndex, images, setCrop],
  );

  return (
    <>
      <input
        type="file"
        className="hidden"
        accept="image/*"
        ref={input_ref}
        onChange={async (event) => {
          const files = event.target.files;
          const file = files?.item(0);
          console.log("input onChange event", file);
          if (!file) return;

          setUploadedImage(undefined);
          setFormImage(undefined);
          setCrop(undefined);
          setImageIndex(undefined);
          // return;

          const response = await upload_image_by_file({
            file,
            custom_title: "thumbnail-uploaded.jpg",
            crop: formImage,
            allow_overwrite: "allow_overwrite",
            draft: true,
            directory: get_s3_draft_directory(editor_store.get.draft_id()),
          });

          console.log("ImageSelector -> response", response);

          if (
            typeof response.file === "undefined" ||
            !("width" in response.file)
          )
            return;

          const editor_image = {
            file: {
              url: response.file.url,
              width: response.file.width,
              height: response.file.height,
            },
            caption: "",
          } satisfies EditorJSImageData;

          setUploadedImage(editor_image);
        }}
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => {
            console.log("b", index, image);

            let width = image.file.width;
            let height = image.file.height;
            if (!image.file.url) {
              width = 0;
              height = 0;
              // return { image_width: 0, image_height: 0 };
            } else if (image.file.url === uploadedImage?.file.url) {
              width = 1600;
              height = 900;
              // return { image_width: 1600, image_height: 900 };
            }

            // const { width, height } = images[imageIndex].file;
            // return { image_width: width, image_height: height };

            return (
              <Card
                key={image.file.url}
                onClick={() => {
                  setImageIndex(index);
                  setCrop(undefined);
                }}
                className={cn(
                  "box-border flex cursor-pointer items-center justify-center border-2 p-2",
                  formImage?.image_url === image.file.url && "border-blue-500",
                )}
              >
                {/* {`${image.file.url.split("/").pop()} ${new Date().toTimeString()}`} */}
                <Image
                  src={image.file.url}
                  alt={`Izbira slike #${index}`}
                  width={width}
                  height={height}
                  className="max-h-[300px] max-w-[300px]"
                />
              </Card>
            );
          })}
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
            // style={{ width: `${images[imageIndex].file.width}px` }}
          >
            <ReactCrop
              onComplete={(c, d) => {
                if (!images[imageIndex]) return;
                setFormImage({
                  image_url: images[imageIndex].file.url,
                  ...d,
                });
              }}
              crop={crop}
              onChange={(pixelCrop) => {
                if (!images[imageIndex]?.file.url) return;

                // console.log("ImageSelector -> crop", pixelCrop);
                setCrop(pixelCrop);
              }}
              aspect={16 / 9}
              ruleOfThirds
              minHeight={100}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                // ref={image_ref}
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
