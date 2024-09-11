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

/* 
https://jknm.s3.eu-central-1.amazonaws.com/potop-v-termalni-izvir-29-02-2008/1_gradbena%20jama.jpg

draft:
bucket: jknm-draft
article_url: id
title

published:
bucket: jknm
article_url
title
*/
interface CopySourceInfo {
  bucket: string;
  file_name: string;
}

const ALLOWED_BLOCK_TYPES = ["image", "attaches"];
const ALLOWERD_BUCKETS = [
  env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
  env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
];

export async function rename_s3_files_and_content(
  editor_content: OutputData,
  updated_url: string,
  draft: boolean,
) {
  const bucket = draft
    ? env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME
    : env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME;

  console.log("rename_s3_files", {
    editor_content,
    published_url: updated_url,
  });

  const sources = rename_urls_in_content(editor_content, updated_url, bucket);

  await s3_copy_between_buckets(sources, updated_url);
  return editor_content;
}

export function rename_urls_in_content(
  editor_content: OutputData,
  article_url: string,
  bucket: string,
): CopySourceInfo[] {
  // console.log("Renaming files in editor", { editor_content, article_url });
  const sources: CopySourceInfo[] = [];

  for (const block of editor_content.blocks) {
    if (!block.id || !ALLOWED_BLOCK_TYPES.includes(block.type)) {
      continue;
    }

    const file_data = block.data as { file: { url: string } };
    const renamed_info = rename_url(file_data.file.url, article_url, bucket);
    if (!renamed_info) continue;
    // console.log("Renamed file", { old_url: file_data.file.url, url });
    file_data.file.url = renamed_info.url;
    sources.push({
      file_name: renamed_info.file_name,
      bucket: renamed_info.bucket,
    });
  }

  return sources;
}

export function rename_url(
  old_url: string,
  article_url: string,
  new_bucket: string,
) {
  const url_parts = new URL(old_url);
  const file_name = url_parts.pathname.split("/").pop();

  if (!file_name) {
    console.error("No name in URL", old_url);
    return;
  }

  const new_url = get_s3_url(`${article_url}/${file_name}`, new_bucket);
  const domain_parts = url_parts.hostname.split(".");
  const old_bucket = domain_parts[0];

  if (!old_bucket) {
    console.error("No bucket in URL", old_url);
    return;
  }

  if (!ALLOWERD_BUCKETS.includes(old_bucket)) {
    console.error("Invalid bucket", old_bucket);
    return;
  }

  return { url: new_url, file_name, bucket: old_bucket };
}

export function get_s3_url(url: string, bucket: string) {
  return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${url}`;
}

export async function s3_copy_between_buckets(
  sources: CopySourceInfo[],
  article_url: string,
) {
  const draft_sources = sources.filter(
    (source) => source.bucket === env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
  );
  const published_sources = sources.filter(
    (source) => source.bucket === env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
  );

  // TODO: article_url wrong
  await clean_s3_directory(
    env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
    article_url,
    draft_sources.map((source) => source.file_name),
  );
  await clean_s3_directory(
    env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
    article_url,
    published_sources.map((source) => source.file_name),
  );

  for (const sources of [draft_sources, published_sources]) {
    for (const source of sources) {
      await s3_copy_file(source, article_url);
    }
  }
}

function s3_copy_file(source: CopySourceInfo, article_url: string) {
  const old_url = get_s3_url(source.file_name, source.bucket);
  const new_url = get_s3_url(
    `${article_url}/${source.file_name}`,
    source.bucket,
  );

  console.log("Copying file", { old_url, new_url });

  const client = new S3Client({ region: env.NEXT_PUBLIC_AWS_REGION });
  return client.send(
    new CopyObjectCommand({
      Bucket: source.bucket,
      CopySource: `${source.bucket}/${source.file_name}`,
      Key: `${article_url}/${source.file_name}`,
      // ACL: "public-read",
    }),
  );
}

// old
export async function rename_s3_directory(old_dir: string, new_dir: string) {
  console.log("renaming from ", old_dir, " to ", new_dir);
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

  console.log("renamed from ", old_dir, " to ", new_dir);
}

async function list_objects(bucket: string, prefix: string) {
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

async function delete_objects(bucket: string, keys: string[]) {
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
  try {
    const objects = await list_objects(bucket, prefix);
    if (typeof objects === "undefined") return;

    const keys = objects.map((object) => {
      if (typeof object.Key === "undefined") {
        throw new Error("Invalid key " + object.Key);
      }

      return object.Key;
    });

    console.log("delete_s3_directory", keys);
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
  try {
    const objects = await list_objects(bucket, directory);
    if (typeof objects === "undefined") {
      console.error(
        "clean_s3_directory: No objects found in directory",
        directory,
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
