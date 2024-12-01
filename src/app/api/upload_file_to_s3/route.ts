"use server";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HeadObjectCommand, NotFound, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import mime from "mime/lite";
import sharp from "sharp";

import { env } from "~/env";
import { getServerAuthSession } from "~/server/auth";
import { convert_filename_to_url } from "~/lib/article-utils";
import { thumbnail_validator } from "~/lib/validators";
import { v4 as uuid } from "uuid";
import path from "path/posix";
import { crop_image } from "~/server/s3-utils";
export interface FileUploadResponse {
  success: 0 | 1;
  file?: FileUploadJSON | ImageUploadJSON;
  error?: "File exists";
}

export interface ImageUploadJSON {
  url: string;
  width?: number;
  height?: number;
}

export interface FileUploadJSON {
  url: string;
  title: string;
  size: number;
  name: string;
  extension: string;
}

export async function POST(request: NextRequest) {
  console.log("upload_file_to_s3 begins");
  const session = await getServerAuthSession();
  if (!session) return NextResponse.error();

  const form_data = await request.formData();

  const directory = form_data.get("directory");
  if (typeof directory !== "string") return NextResponse.error();

  let file = form_data.get("file");
  const file_type = form_data.get("type");
  const external_url = form_data.get("url");
  const crop_entry = form_data.get("crop");
  const allow_overwrite = form_data.get("allow_overwrite");
  const bucket_string = form_data.get("bucket");
  let title = form_data.get("title");
  let mime_type = "";
  let key = "";

  let bucket: string | undefined = undefined;
  if (bucket_string === "draft") {
    bucket = env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME;
  } else if (bucket_string === "published") {
    bucket = env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME;
  } else {
    return NextResponse.error();
  }

  // TODO: encode with convert_title_to_url
  if ((file_type === "image" || file_type === "file") && file instanceof File) {
    // Upload from a file.
    // key = `${directory}/${convert_filename_to_url(file.name)}`;
    if (typeof title !== "string") {
      title = file.name;
    }

    mime_type = file.type;
  } else if (
    file_type === "image" &&
    typeof external_url === "string" &&
    typeof title === "string"
  ) {
    // Upload from an URL.
    let mime_type: string;
    if (!title) {
      console.error("Image doesn't have a title", external_url);
      title = "unknown_image.jpg";
      mime_type = "image/jpeg";
    } else {
      mime_type = mime.getType(title) ?? "image/*";
    }

    const url_image_response = await fetch(external_url);
    const blob = await url_image_response.blob();
    file = new File([blob], title, { type: mime_type });

    if (typeof crop_entry === "string") {
      const crop = JSON.parse(crop_entry) as unknown;
      const validated_crop = thumbnail_validator.parse(crop);
      file = await crop_image(file, validated_crop);
    }
  } else {
    return NextResponse.error();
  }

  key = `${directory}/${convert_filename_to_url(title)}`;
  console.log("upload_file_to_s3", {
    directory,
    file_type,
    external_url,
    title,
    mime_type,
    key,
    bucket,
  });
  const client = new S3Client({
    region: env.NEXT_PUBLIC_AWS_REGION,
    endpoint: "https://s3.eu-central-003.backblazeb2.com",
  });

  // Check if the file already exists
  if (allow_overwrite !== "allow_overwrite") {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      // console.log("File exists, because it doesn't throw", key);
      const key_path = path.parse(key);
      const new_name = `${key_path.name}-${uuid()}${key_path.ext}`;
      key = path.join(key_path.dir, new_name).replace(/\\/g, "/");
      // console.log("New key", key);

      // return NextResponse.json({ success: 0, error: "File exists" });
    } catch (error: unknown) {
      if (!(error instanceof NotFound)) {
        return NextResponse.error();
      }
    }
  }

  const { url, fields } = await createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ["content-length-range", 0, 5 * 10485760], // up to 10 MB
      ["starts-with", "$Content-Type", mime_type],
    ],
    Fields: {
      // acl: "public-read",
      "Content-Type": mime_type,
    },
    Expires: 600, // Seconds before the presigned post expires. 3600 by default.
  });

  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append("file", file);

  /* console.log("upload_file_to_s3 before uploading to presigned url", {
    url,
    fields,
    file,
  }); */
  const upload_response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!upload_response.ok) {
    console.error("Failed to upload file", {
      upload_response,
      fields,
      file,
      bucket,
      key,
      formData,
    });
    return NextResponse.error();
  }

  let file_data: ImageUploadJSON | FileUploadJSON | undefined = undefined;

  if (file_type === "image") {
    const image_buffer = await file.arrayBuffer();
    const image_metadata = await sharp(image_buffer).metadata();
    const image_width = image_metadata.width;
    const image_height = image_metadata.height;

    if (!fields.key) return NextResponse.error();
    file_data = {
      url: `${url}${fields.key}`,
      width: image_width,
      height: image_height,
    };
  } else {
    file_data = {
      url: `${url}${fields.key}`,
      title: file.name,
      size: file.size,
      name: file.name,
      extension: file.name.split(".").pop() ?? "",
    };
  }

  const response_json = {
    success: 1,
    file: file_data,
  } satisfies FileUploadResponse;

  // console.log("upload_file_to_s3", response_json);

  return NextResponse.json(response_json);
}
