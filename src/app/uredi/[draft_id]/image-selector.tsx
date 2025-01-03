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
import { PlusIcon, TrashIcon } from "lucide-react";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { upload_image_by_file } from "~/components/aws-s3/upload-file";
import { get_s3_draft_directory } from "~/lib/article-utils";
import { get_s3_prefix } from "~/lib/s3-publish";
import { env } from "~/env";
import { DraftArticleContext } from "~/components/article/context";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import type { delete_custom_thumbnail_validator } from "~/server/article/validators";
import { delete_custom_thumbnail } from "~/server/article/delete";

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
  const [uploadedVersion, setUploadedVersion] = useState<number>(Date.now());
  const [customThumbnailExists, setCustomThumbnailExists] = useState<boolean>(
    formImage?.uploaded_custom_thumbnail ?? false,
  );
  const [doCenterCrop, setDoCenterCrop] = useState<boolean>(false);
  const [imageIndex, setImageIndex] = useState<number | undefined>(undefined);
  const toaster = useToast();

  const delete_custom_thumbnail_mutation = useMutation({
    mutationFn: (input: z.infer<typeof delete_custom_thumbnail_validator>) =>
      delete_custom_thumbnail(input),
    onSuccess: () => {
      setCustomThumbnailExists(false);
      setFormImage(undefined);
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri brisanju slike",
        description: error.message,
      });
    },
  });

  const custom_thumbnail_url = useMemo(() => {
    if (!draft_article) return "";

    return get_s3_prefix(
      `${get_s3_draft_directory(draft_article.id)}/thumbnail-uploaded.png`,
      env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
    );
  }, [draft_article]);

  const images = useMemo(() => {
    const temp = [...store_images];

    if (customThumbnailExists && draft_article) {
      const editor_image = {
        file: {
          url: custom_thumbnail_url,
        },
        caption: "",
      } satisfies EditorJSImageData;

      temp.push(editor_image);
    }

    return temp;
  }, [
    customThumbnailExists,
    custom_thumbnail_url,
    draft_article,
    store_images,
  ]);

  useEffect(() => {
    setCrop(formImage);
  }, [formImage, imageIndex]);

  useEffect(() => {
    if (!formImage || typeof imageIndex === "number") return;

    const selected_image_index = images.findIndex(
      (image) => image.file.url === formImage.image_url,
    );

    if (selected_image_index === -1) {
      setImageIndex(undefined);
      return;
    }

    setImageIndex(selected_image_index);
  }, [formImage, imageIndex, images]);

  const handle_image_load = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: width, naturalHeight: height } =
        event.currentTarget;

      if (typeof imageIndex !== "number") return;
      const image_url = images[imageIndex]?.file.url;

      if (typeof image_url === "undefined") return;
      let current_crop: Crop | undefined;
      if (!doCenterCrop) {
        current_crop = crop;
      }

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

      const thumbnail = {
        ...current_crop,
        uploaded_custom_thumbnail: customThumbnailExists,
        image_url,
        unit: "%",
      } satisfies ThumbnailType;

      setDoCenterCrop(false);
      setFormImage(thumbnail);
    },
    [
      crop,
      customThumbnailExists,
      doCenterCrop,
      imageIndex,
      images,
      setFormImage,
    ],
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
          if (!file) return;

          setFormImage(undefined);
          setCustomThumbnailExists(false);

          const response = await upload_image_by_file({
            file,
            custom_title: "thumbnail-uploaded.png",
            crop: formImage,
            allow_overwrite: "allow_overwrite",
            draft: true,
            directory: get_s3_draft_directory(editor_store.get.draft_id()),
          });

          if (
            typeof response.file === "undefined" ||
            !("width" in response.file)
          ) {
            return;
          }

          setCustomThumbnailExists(true);
          setUploadedVersion(Date.now());
        }}
      />
      <div className="flex gap-4">
        <ScrollArea className="h-[65vh] overflow-y-auto py-4">
          <div className="flex flex-grow flex-wrap gap-2">
            {images.map((image, index) => {
              let width = image.file.width;
              let height = image.file.height;
              let is_custom_image = false;
              if (!image.file.url) {
                width = 0;
                height = 0;
              }

              if (image.file.url.endsWith("thumbnail-uploaded.png")) {
                is_custom_image = true;
                width = 300;
                height = (300 * 9) / 16;
              }

              return (
                <Card
                  key={`${image.file.url}-${index}`}
                  className={cn(
                    "box-border flex cursor-pointer items-center justify-center border-2 p-2",
                    imageIndex === index && "border-blue-500",
                    "max-h-[300px] max-w-[300px]",
                    "relative",
                  )}
                >
                  <Image
                    src={`${image.file.url}?v=${uploadedVersion}`}
                    alt={`Izbira slike #${index}`}
                    width={width}
                    height={height}
                    className="h-full w-full rounded-sm object-contain"
                    onClick={() => {
                      setFormImage(undefined);
                      setUploadedVersion(Date.now());
                      setImageIndex(index);
                      setDoCenterCrop(true);
                    }}
                  />
                  {is_custom_image && (
                    <Button
                      size="icon"
                      variant="destructive"
                      type="button"
                      className="absolute right-0 top-0 m-4 shadow-2xl"
                      onClick={() => {
                        delete_custom_thumbnail_mutation.mutate({
                          draft_id: editor_store.get.draft_id(),
                        });
                      }}
                    >
                      <TrashIcon />
                    </Button>
                  )}
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
        </ScrollArea>
        {typeof imageIndex === "number" && images[imageIndex]?.file.url && (
          <div className="flex w-[500px] max-w-[500px] items-center justify-center">
            <ReactCrop
              className="w-full"
              onComplete={(_, percent_crop) => {
                if (!images[imageIndex]) return;

                setFormImage({
                  ...percent_crop,
                  image_url: images[imageIndex].file.url,
                  uploaded_custom_thumbnail: customThumbnailExists,
                });
              }}
              crop={crop}
              onChange={(pixelCrop) => {
                setCrop(pixelCrop);
              }}
              aspect={16 / 9}
              ruleOfThirds
              minHeight={50}
              minWidth={50}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${images[imageIndex].file.url}?v=${uploadedVersion}`}
                alt="Cropped image"
                width={images[imageIndex].file.width}
                height={images[imageIndex].file.height}
                className="h-full w-full min-w-[500px] object-contain"
                onLoad={(event) => handle_image_load(event)}
              />
            </ReactCrop>
          </div>
        )}
      </div>
    </>
  );
}
