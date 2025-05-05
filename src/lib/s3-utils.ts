"use server";

import type { _Object } from "@aws-sdk/client-s3";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import type { OutputData } from "@editorjs/editorjs";
import type { PercentCrop } from "react-image-crop";

/* TODO: CRITICAL, SHARP */
import sharp from "sharp";

import { env } from "~/env";
import type { S3CopySourceInfo } from "~/lib/s3-publish";
import { rename_urls_in_content, s3_copy_file } from "~/lib/s3-publish";
import type { ThumbnailType } from "~/lib/validators";

export async function rename_s3_files_and_content(
  editor_content: OutputData,
  destination_url: string,
  draft: boolean,
) {
  const destination_bucket = draft
    ? env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME
    : env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME;

  const { sources, new_content } = rename_urls_in_content(
    editor_content,
    destination_url,
    destination_bucket,
  );

  // draft_sources means that the files are in draft bucket
  const draft_sources = sources.filter(
    (source) => source.source_bucket === env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
  );
  const published_sources = sources.filter(
    (source) =>
      source.source_bucket === env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
  );

  console.log("s3 utils rename", {
    destination_bucket,
    destination_url,
    draft_sources,
    published_sources,
  });
  for (const sources of [draft_sources, published_sources]) {
    await s3_copy_between_buckets(sources, destination_bucket, destination_url);
  }

  return new_content;
}

export async function s3_copy_thumbnails({
  source_bucket,
  source_path,
  destination_bucket,
  destination_url,
  thumbnail_crop,
}: {
  source_bucket: string;
  source_path: string;
  destination_bucket: string;
  destination_url: string;
  thumbnail_crop: ThumbnailType | undefined;
}) {
  const names: string[] = [];

  if (thumbnail_crop) {
    names.push("thumbnail.png");
    if (thumbnail_crop.uploaded_custom_thumbnail) {
      names.push("thumbnail-uploaded.png");
    }
  }

  for (const name of names) {
    const source = {
      file_name: name,
      source_bucket,
      source_path,
      destination_url: `${destination_url}/thumbnail.png`,
    } satisfies S3CopySourceInfo;

    await s3_copy_file(source, destination_bucket, destination_url);
  }
}

export async function s3_copy_between_buckets(
  sources: S3CopySourceInfo[],
  destination_bucket: string,
  destination_url: string,
) {
  /* console.log("s3_copy_between_buckets", {
    sources,
    destination_bucket,
    destination_url,
  }); */

  for (const source of sources) {
    await s3_copy_file(source, destination_bucket, destination_url);
  }
}

// old
export async function rename_s3_directory(old_dir: string, new_dir: string) {
  // console.log("rename_s3_directory", { old_dir, new_dir });
  const client = new S3Client({
    region: env.NEXT_PUBLIC_AWS_REGION,
    endpoint: "https://s3.eu-central-003.backblazeb2.com",
  });
  let objects: _Object[] | undefined;

  try {
    const response = await client.send(
      new ListObjectsCommand({
        Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
        Prefix: old_dir,
      }),
    );

    objects = response.Contents;
  } catch (error) {
    console.error("Error listing objects:", error);
  }

  if (!objects) return;

  for (const object of objects) {
    const key = object.Key;
    if (!key) {
      console.error("Object doesn't have a key:", object);
      continue;
    }

    const new_key = key.replace(old_dir, new_dir);

    try {
      await client.send(
        new CopyObjectCommand({
          Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
          CopySource: `${env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME}/${key}`,
          Key: new_key,
          // ACL: "public-read",
        }),
      );
    } catch (error) {
      console.error("Error copying object:", error);
    }
  }

  try {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
        Delete: {
          Objects: objects.map((object) => ({ Key: object.Key })),
        },
      }),
    );
  } catch (error) {
    console.error("Error deleting object:", error);
  }
}

export async function list_objects(bucket: string, prefix: string) {
  try {
    const client = new S3Client({
      region: env.NEXT_PUBLIC_AWS_REGION,
      endpoint: "https://s3.eu-central-003.backblazeb2.com",
    });
    const response = await client.send(
      new ListObjectsV2Command({
        // Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
        Bucket: bucket,
        Prefix: prefix,
      }),
    );

    return response.Contents;
  } catch (error) {
    console.error("Error listing objects:", error);
    throw error;
  }
}

export async function delete_objects(bucket: string, keys: string[]) {
  // console.log("delete_objects", { bucket, keys });
  try {
    const client = new S3Client({
      region: env.NEXT_PUBLIC_AWS_REGION,
      endpoint: "https://s3.eu-central-003.backblazeb2.com",
    });
    return await client.send(
      new DeleteObjectsCommand({
        // Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  } catch (error) {
    console.error("Error listing objects:", error);
    throw error;
  }
}

export async function delete_s3_directory(bucket: string, prefix: string) {
  // console.log("delete_s3_directory", { bucket, prefix });
  try {
    const objects = await list_objects(bucket, prefix);
    if (typeof objects === "undefined") return;

    const keys = objects.map((object) => {
      if (typeof object.Key === "undefined") {
        throw new Error("Invalid key " + object.Key);
      }

      return object.Key;
    });

    // console.log("delete_s3_directory", { keys, bucket, prefix });
    if (keys.length > 0) await delete_objects(bucket, keys);
  } catch (error) {
    console.error("Error deleting directory:", error);
  }
}

export async function clean_s3_directory(
  bucket: string,
  directory: string,
  filenames_to_keep: string[],
) {
  // console.log("clean_s3_directory", { bucket, directory, filenames_to_keep });

  try {
    const objects = await list_objects(bucket, directory);
    if (typeof objects === "undefined") {
      console.warn(
        "clean_s3_directory: No objects found in directory, returning",
      );
      return;
    }

    const object_names = objects.map((object) => {
      const parts = object.Key?.split("/");
      if (!parts || parts.length !== 2) {
        throw new Error("clean_s3_directory: Invalid key " + object.Key);
      }

      return parts.at(-1);
    });

    const keys_to_delete = object_names
      .filter((key): boolean => {
        if (typeof key === "undefined") return false;

        return !filenames_to_keep.includes(key);
      })
      .filter((key) => key !== undefined)
      .map((key) => `${directory}/${key}`);

    /* console.log("keys_to_delete", keys_to_delete, {
      directory,
      object_names,
      filenames_to_keep,
      objects,
    }); */

    if (keys_to_delete.length > 0) await delete_objects(bucket, keys_to_delete);
  } catch (error) {
    console.error("Error cleaning directory:", error);
  }
}

export async function crop_image(file: File, crop: PercentCrop): Promise<File> {
  // console.log("crop image", { file, crop });

  const image_buffer = await file.arrayBuffer();
  const sharp_image = sharp(image_buffer);
  const metadata = await sharp_image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to retrieve image dimensions");
  }

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;

  // Convert percentage crop values to pixels
  const cropX = Math.round((crop.x / 100) * originalWidth);
  const cropY = Math.round((crop.y / 100) * originalHeight);
  const cropWidth = Math.round((crop.width / 100) * originalWidth);
  const cropHeight = Math.round((crop.height / 100) * originalHeight);

  // console.log("crop image", { cropX, cropY, cropWidth, cropHeight });
  const cropped_buffer = await sharp_image
    .extract({
      left: cropX,
      top: cropY,
      width: cropWidth,
      height: cropHeight,
    })
    .toBuffer();

  return new File([cropped_buffer], file.name, { type: file.type });
}
