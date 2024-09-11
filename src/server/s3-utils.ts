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

export function rename_content(editor_content: OutputData | null) {
  return editor_content;
}

const ALLOWED_BLOCK_TYPES = ["image", "attaches"];

export function rename_urls_in_editor(
  editor_content: OutputData,
  article_url: string,
  draft: boolean,
) {
  console.log("Renaming files in editor", { editor_content, article_url });

  for (const block of editor_content.blocks) {
    if (!block.id || !ALLOWED_BLOCK_TYPES.includes(block.type)) {
      continue;
    }

    const file_data = block.data as { file: { url: string } };
    const new_url = rename_url(file_data.file.url, article_url, draft);
    // console.log("Renamed file", { old_url: file_data.file.url, new_url });
    file_data.file.url = new_url;
  }
}

export function rename_url(
  old_url: string,
  article_url: string,
  draft: boolean,
) {
  const url_parts = new URL(old_url);
  const file_name = url_parts.pathname.split("/").pop();

  if (!file_name) {
    console.error("No name in URL", old_url);
    return old_url;
  }

  const new_url = get_s3_url(`${article_url}/${file_name}`, draft);
  return new_url;
}

export function get_s3_url(url: string, draft?: boolean) {
  const bucket = draft
    ? env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME
    : env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME;

  return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${url}`;
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
          ACL: "public-read",
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

async function list_objects(prefix: string) {
  try {
    const client = new S3Client({ region: env.NEXT_PUBLIC_AWS_REGION });
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
        Prefix: prefix,
      }),
    );

    return response.Contents;
  } catch (error) {
    console.error("Error listing objects:", error);
    throw error;
  }
}

async function delete_objects(keys: string[]) {
  try {
    const client = new S3Client({ region: env.NEXT_PUBLIC_AWS_REGION });
    const response = await client.send(
      new DeleteObjectsCommand({
        Bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );

    return response;
  } catch (error) {
    console.error("Error listing objects:", error);
    throw error;
  }
}

export async function delete_s3_directory(prefix: string) {
  try {
    const objects = await list_objects(prefix);
    if (typeof objects === "undefined") return;

    const keys = objects.map((object) => {
      if (typeof object.Key === "undefined") {
        throw new Error("Invalid key " + object.Key);
      }

      return object.Key;
    });

    console.log("delete_s3_directory", keys);
    if (keys.length > 0) await delete_objects(keys);
  } catch (error) {
    console.error("Error deleting directory:", error);
  }
}

export async function clean_s3_directory(
  directory: string,
  filenames_to_keep: string[],
) {
  try {
    const objects = await list_objects(directory);
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

      return parts[parts.length - 1];
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

    if (keys_to_delete.length > 0) await delete_objects(keys_to_delete);
  } catch (error) {
    console.error("Error cleaning directory:", error);
  }
}
