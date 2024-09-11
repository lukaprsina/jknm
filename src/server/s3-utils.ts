"use server";

import type { _Object } from "@aws-sdk/client-s3";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

import { env } from "~/env";

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
