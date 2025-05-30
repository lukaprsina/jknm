import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { OutputData } from "@editorjs/editorjs";
import { klona } from "klona";
import { env } from "~/env";
import { list_objects, s3_copy_between_buckets } from "~/lib/s3-utils";

export function get_s3_prefix(url: string, bucket: string) {
  // return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${url}`;
  return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.backblazeb2.com/${url}`;
}

const ALLOWERD_BUCKETS = [
  env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
  env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
];

export interface S3CopySourceInfo {
  destination_url: string;
  file_name: string;
  source_bucket: string;
  source_path: string;
}

const ALLOWED_BLOCK_TYPES = ["image", "attaches"];
export function rename_urls_in_content(
  editor_content: OutputData,
  destination_url: string,
  bucket: string,
): { sources: S3CopySourceInfo[]; new_content: OutputData } {
  // console.log("Renaming files in editor", { editor_content, article_url });
  const sources: S3CopySourceInfo[] = [];
  const new_content = klona(editor_content);
  for (const block of new_content.blocks) {
    if (!block.id || !ALLOWED_BLOCK_TYPES.includes(block.type)) {
      continue;
    }
    const file_data = block.data as { file: { url: string } };
    const url_parts = new URL(file_data.file.url);
    const source_bucket = get_source_bucket(url_parts);
    if (!source_bucket) {
      console.error("No bucket in URL");
      continue;
    }
    const renamed_info = rename_url(
      url_parts.pathname,
      source_bucket,
      destination_url,
      bucket,
    );
    if (!renamed_info) continue;
    // console.log("Renamed file", { old_url: file_data.file.url, url });
    file_data.file.url = renamed_info.destination_url;
    sources.push(renamed_info);
  }
  // console.log("rename_urls_in_content", sources);
  return { sources, new_content };
}

export function get_source_bucket(url_parts: URL) {
  const domain_parts = url_parts.hostname.split(".");
  const source_bucket = domain_parts[0];

  return source_bucket;
}

// TODO: rename thumbnail
export function rename_url(
  old_url: string,
  source_bucket: string,
  destination_url: string,
  destination_bucket: string,
): S3CopySourceInfo | undefined {
  const pathname_parts = old_url.split("/").filter(Boolean);

  /* console.log("rename_url", {
    old_url,
    source_bucket,
    destination_url,
    destination_bucket,
    pathname_parts,
  }); */

  if (pathname_parts.length !== 2) {
    console.error("Renaming invalid URL (2 parts)", old_url, pathname_parts);
    return;
  }

  const source_path = pathname_parts[0];
  const file_name = pathname_parts[1];

  if (!source_path || !file_name) {
    console.error("No name in URL", old_url);
    return;
  }

  const new_url = get_s3_prefix(
    `${destination_url}/${file_name}`,
    destination_bucket,
  );

  if (!ALLOWERD_BUCKETS.includes(source_bucket)) {
    console.error("Invalid bucket", source_bucket);
    return;
  }

  return { destination_url: new_url, file_name, source_bucket, source_path };
}

export async function s3_copy_file(
  source: S3CopySourceInfo,
  destination_bucket: string,
  destination_url: string,
) {
  // const CopySource = `/jknm-osnutki/${source.source_path}/${source.file_name}`;
  const CopySource = `/${source.source_bucket}/${source.source_path}/${source.file_name}`;
  const Key = `${destination_url}/${source.file_name}`;

  console.log("s3_copy_file", {
    source,
    Key,
    CopySource,
    destination_url,
    destination_bucket,
  });

  const client = new S3Client({
    region: env.NEXT_PUBLIC_AWS_REGION,
    endpoint: "https://s3.eu-central-003.backblazeb2.com",
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  try {
    return await client.send(
      new CopyObjectCommand({
        CopySource,
        Bucket: destination_bucket,
        Key,
      }),
    );
  } catch (error) {
    console.error("Error copying file", error);
  }
}

export async function s3_copy({
  source_bucket,
  source_url,
  destination_bucket,
  destination_url,
}: {
  source_bucket: string;
  source_url: string;
  destination_bucket: string;
  destination_url: string;
}) {
  const source_files = await list_objects(source_bucket, source_url);

  if (!source_files) {
    return;
  }

  const sources: S3CopySourceInfo[] = [];
  for (const file of source_files) {
    if (!file.Key) continue;
    const renamed_info = rename_url(
      file.Key,
      source_bucket,
      destination_url,
      destination_bucket,
    );

    if (!renamed_info) continue;
    sources.push(renamed_info);
  }

  /* console.log("s3_copy", {
    source_bucket,
    source_url,
    destination_bucket,
    destination_url,
    source_files,
    sources,
  }); */

  await s3_copy_between_buckets(sources, destination_bucket, destination_url);
}
