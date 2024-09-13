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

import { env } from "~/env";
import type { S3CopySourceInfo } from "~/lib/s3-publish";
import { rename_urls_in_content, s3_copy_file } from "~/lib/s3-publish";

export async function rename_s3_files_and_content(
  editor_content: OutputData,
  destination_url: string,
  draft: boolean,
) {
  const destination_bucket = draft
    ? env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME
    : env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME;

  console.log("rename_s3_files_and_content", {
    editor_content,
    destination_url,
    destination_bucket,
  });

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

  /* if (draft) {
    await clean_s3_directory(
      env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
      destination_url,
      draft_sources.map((source) => source.file_name),
    );
  } else {
    await clean_s3_directory(
      env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
      destination_url,
      published_sources.map((source) => source.file_name),
    );
  } */

  for (const sources of [draft_sources, published_sources]) {
    await s3_copy_between_buckets(sources, destination_bucket, destination_url);
  }

  return new_content;
}

export async function s3_copy_between_buckets(
  sources: S3CopySourceInfo[],
  destination_bucket: string,
  destination_url: string,
) {
  console.log("s3_copy_between_buckets", {
    sources,
    destination_bucket,
    destination_url,
  });

  for (const source of sources) {
    await s3_copy_file(source, destination_bucket, destination_url);
  }
}

// old
export async function rename_s3_directory(old_dir: string, new_dir: string) {
  console.log("rename_s3_directory", { old_dir, new_dir });
  const client = new S3Client({ region: env.NEXT_PUBLIC_AWS_REGION });
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
    const client = new S3Client({ region: env.NEXT_PUBLIC_AWS_REGION });
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
  console.log("delete_objects", { bucket, keys });
  try {
    const client = new S3Client({ region: env.NEXT_PUBLIC_AWS_REGION });
    const response = await client.send(
      new DeleteObjectsCommand({
        // Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );

    return response;
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

    console.log("delete_s3_directory", { keys, bucket, prefix });
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
  console.log("clean_s3_directory", { bucket, directory, filenames_to_keep });

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

    console.log("keys_to_delete", keys_to_delete, {
      directory,
      object_names,
      filenames_to_keep,
      objects,
    });

    if (keys_to_delete.length > 0) await delete_objects(bucket, keys_to_delete);
  } catch (error) {
    console.error("Error cleaning directory:", error);
  }
}
