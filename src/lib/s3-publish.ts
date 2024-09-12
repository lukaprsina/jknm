import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { OutputData } from "@editorjs/editorjs";
import { klona } from "klona";
import { env } from "~/env";

export function get_s3_url(url: string, bucket: string) {
  return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${url}`;
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
    const renamed_info = rename_url(
      file_data.file.url,
      destination_url,
      bucket,
    );
    if (!renamed_info) continue;
    // console.log("Renamed file", { old_url: file_data.file.url, url });
    file_data.file.url = renamed_info.destination_url;
    sources.push(renamed_info);
  }

  console.log("rename_urls_in_content", sources);
  return { sources, new_content };
}

// TODO: rename thumbnail
export function rename_url(
  old_url: string,
  destination_url: string,
  destination_bucket: string,
): S3CopySourceInfo | undefined {
  const url_parts = new URL(old_url);
  const pathname_parts = url_parts.pathname.split("/").filter(Boolean);
  if (pathname_parts.length !== 2) {
    console.error("Invalid URL", old_url, pathname_parts);
    return;
  }

  const source_path = pathname_parts[0];
  const file_name = pathname_parts[1];

  if (!source_path || !file_name) {
    console.error("No name in URL", old_url);
    return;
  }

  const new_url = get_s3_url(
    `${destination_url}/${file_name}`,
    destination_bucket,
  );
  const domain_parts = url_parts.hostname.split(".");
  const source_bucket = domain_parts[0];

  if (!source_bucket) {
    console.error("No bucket in URL", old_url);
    return;
  }

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
  const CopySource = `${source.source_bucket}/${source.source_path}/${source.file_name}`;
  const Key = `${destination_url}/${source.file_name}`;

  console.log("Copying file", {
    source,
    Key,
    CopySource,
    destination_url,
    destination_bucket,
  });

  const client = new S3Client({ region: env.NEXT_PUBLIC_AWS_REGION });
  return await client.send(
    new CopyObjectCommand({
      CopySource,
      Bucket: destination_bucket,
      Key,
      // ACL: "public-read",
    }),
  );
}
