// "use client";

import Image from "next/image";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { get_s3_prefix } from "~/lib/s3-publish";
import { env } from "~/env";
import { DraftArticleContext } from "~/components/article/context";

export function ImageSelector({
  image: formImage,
  setImage: setFormImage,
}: {
  image: ThumbnailType | undefined;
  setImage: (image: ThumbnailType | undefined) => void;
}) {
  const draft_article = useContext(DraftArticleContext);
  const store_images = editor_store.use.image_data();
  const input_ref = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState<Crop>();
  // const [uploadedImageDimensions, setUploadedImageDimensions] = useState<ImageDimensions | undefined>(undefined)

  const [imageIndex, setImageIndex] = useState<number | undefined | "loading">(
    undefined,
  );

  const images = useMemo(() => {
    const temp = [...store_images];

    if (formImage?.uploaded_custom_thumbnail && draft_article) {
      // TODO store actual width, height
      const editor_image = {
        file: {
          url: get_s3_prefix(
            `${draft_article.id}/thumbnail-uploaded.png`,
            env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
          ),
        },
        caption: "",
      } satisfies EditorJSImageData;

      temp.push(editor_image);
    }

    console.log("images", {temp, formImage, store_images})
    return temp;
  }, [draft_article, formImage, store_images]);

  useEffect(() => {
    console.log("useEffect", { imageIndex, formImage });
    if (typeof imageIndex !== "undefined") {
      return;
    }
    console.log("useEffect after")

    if (formImage?.uploaded_custom_thumbnail) {
      console.log("formImage custom", { formImage, imageIndex });
    } else {
      const selected_image_index = images.findIndex(
        (image) => image.file.url === formImage?.image_url,
      );

      console.log("formImage from article", {
        formImage,
        imageIndex,
        images,
        selected_image_index,
      });
      if (selected_image_index === -1) return;

      setImageIndex(selected_image_index);
    }

    setCrop(formImage);
  }, [formImage, imageIndex, images]);

  const handle_image_load = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: width, naturalHeight: height } =
        event.currentTarget;

      console.log("handle_image_load", {
        width,
        height,
        images,
        imageIndex,
        formImage,
        crop,
      });

      if (typeof imageIndex === "number" && !images[imageIndex]?.file.url)
        return;

      let current_crop: Crop | undefined = crop;

      if (!current_crop) {
        current_crop = centerCrop(
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
      }

      setCrop(current_crop);
    },
    [crop, formImage, imageIndex, images],
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

          setFormImage(undefined);
          setCrop(undefined);
          setImageIndex("loading");

          if (formImage) {
            setFormImage({
              ...formImage,
              uploaded_custom_thumbnail: false,
            });
          }

          const response = await upload_image_by_file({
            file,
            custom_title: "thumbnail-uploaded.png",
            crop: formImage,
            allow_overwrite: "allow_overwrite",
            draft: true,
            directory: get_s3_draft_directory(editor_store.get.draft_id()),
          });

          console.log("ImageSelector -> response", response);

          await sleep(5000)

          if (
            !formImage ||
            typeof response.file === "undefined" ||
            !("width" in response.file)
          ) {
            return;
          }

          /*if(response.file.width && response.file.height) {
            setUploadedImageDimensions({
              width: response.file.width,
              height: response.file.height
            })
          }*/

          setFormImage({
            ...formImage,
            uploaded_custom_thumbnail: true,
          });
        }}
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => {
            // console.log("b", index, image);

            let width = image.file.width;
            let height = image.file.height;
            if (!image.file.url) {
              width = 0;
              height = 0;
            }

            if (image.file.url.endsWith("thumbnail-uploaded.png")) {
              console.log("AAAAAA", image.file.url);
              width = 300;
              height = (300 * 9) / 16;
            }

            return (
              <Card
                key={`${image.file.url}-${index}`}
                onClick={() => {
                  setCrop(undefined);
                  setImageIndex(index);
                }}
                className={cn(
                  "box-border flex cursor-pointer items-center justify-center border-2 p-2",
                  imageIndex === index && "border-blue-500",
                )}
              >
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
        {typeof imageIndex === "number" && images[imageIndex]?.file.url && (
          <div className="max-w-[500px]">
            <ReactCrop
              onComplete={(_, d) => {
                if (!images[imageIndex]) return;
                setFormImage({
                  ...d,
                  image_url: images[imageIndex].file.url,
                  uploaded_custom_thumbnail: formImage?.uploaded_custom_thumbnail,
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
                alt="Cropped image"
                onLoad={(event) => handle_image_load(event)}
              />
            </ReactCrop>
          </div>
        )}
      </div>
    </>
  );
}

export function sleep(ms:number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}