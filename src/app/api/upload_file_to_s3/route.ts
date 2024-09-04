"use server";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HeadObjectCommand, NotFound, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import mime from "mime/lite";
import sharp from "sharp";

import { env } from "~/env";

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
  const form_data = await request.formData();

  const directory = form_data.get("directory");
  if (typeof directory !== "string") return NextResponse.error();

  let file = form_data.get("file");
  const file_type = form_data.get("type");
  const external_url = form_data.get("url");
  let title = form_data.get("title");
  let mime_type = "";
  let key = "";

  if ((file_type === "image" || file_type === "file") && file instanceof File) {
    // Upload from a file.
    key = `${directory}/${file.name}`;
    mime_type = file.type;
  } else if (
    file_type === "image" &&
    typeof external_url === "string" &&
    typeof title === "string"
  ) {
    // Upload from an URL.
    key = `${directory}/${title}`;

    let mime_type: string;
    if (!title) {
      console.error("Image doesn't have a title", external_url);
      title = "unknown_image.jpg";
      mime_type = "image/jpeg";
    } else {
      mime_type = mime.getType(title) ?? "image/*";
    }

    const url_image_respinse = await fetch(external_url);
    const blob = await url_image_respinse.blob();
    file = new File([blob], title, { type: mime_type });
  } else {
    return NextResponse.error();
  }

  const client = new S3Client({ region: env.AWS_REGION });

  // Check if the file already exists
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: env.AWS_BUCKET_NAME,
        Key: key,
      }),
    );

    return NextResponse.json({ success: 0, error: "File exists" });
  } catch (error: unknown) {
    if (!(error instanceof NotFound)) {
      return NextResponse.error();
    }
  }

  const { url, fields } = await createPresignedPost(client, {
    Bucket: env.AWS_BUCKET_NAME,
    Key: key, //uuidv4(),
    Conditions: [
      ["content-length-range", 0, 5 * 10485760], // up to 10 MB
      ["starts-with", "$Content-Type", mime_type],
    ],
    Fields: {
      acl: "public-read",
      "Content-Type": mime_type,
    },
    Expires: 600, // Seconds before the presigned post expires. 3600 by default.
  });

  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append("file", file);

  const uploadResponse = await fetch(url, {
    method: "POST",
    body: formData,
  });

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

  console.log("upload_file_to_s3", file_data);
  const response_json = {
    success: 1,
    file: file_data,
  } satisfies FileUploadResponse;
  return uploadResponse.ok
    ? NextResponse.json(response_json)
    : NextResponse.error();
}
