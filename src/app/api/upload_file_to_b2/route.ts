"use server";

/* TODO: CRITICAL ERROR */

import B2 from "b2-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import mime from "mime/lite";

import { env } from "~/env";
import { getServerAuthSession } from "~/server/auth";
import { convert_filename_to_url } from "~/lib/article-utils";
import { thumbnail_validator } from "~/lib/validators";
import { crop_image } from "~/lib/s3-utils";
import sharp from "sharp";

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
  console.log("upload_file_to_b2 start of function");
  const session = await getServerAuthSession();
  if (!session) return NextResponse.error();

  const form_data = await request.formData();

  const directory = form_data.get("directory");
  if (typeof directory !== "string") return NextResponse.error();

  let file = form_data.get("file");
  const file_type = form_data.get("type");
  const external_url = form_data.get("url");
  const crop_entry = form_data.get("crop");
  // const allow_overwrite = form_data.get("allow_overwrite");
  const bucket_string = form_data.get("bucket");
  let title = form_data.get("title");

  if (typeof title !== "string" && title !== null) {
    console.log("Title is not a string", title, typeof title);
    throw new Error("Title is not a string");
  }

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
  // TODO:  && file instanceof File gives an error: ReferenceError: File is not defined
  if (
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
    const uncropped_file = new File([blob], title, { type: mime_type });

    if (typeof crop_entry === "string") {
      const crop = JSON.parse(crop_entry) as unknown;
      const validated_crop = thumbnail_validator.parse(crop);
      file = await crop_image(uncropped_file, validated_crop);
    }
  } else if (file_type === "image" || file_type === "file") {
    if (typeof file !== "string" && file) {
      // Upload from a file.
      // key = `${directory}/${convert_filename_to_url(file.name)}`;
      if (typeof title !== "string") {
        title = file.name;
      }

      mime_type = file.type;
    } else {
      title = "unknown_image.jpg";
    }
  } else {
    return NextResponse.error();
  }
  // https://jknm-osnutki.s3.eu-central-003.backblazeb2.com/519/519_154.jpg
  // key = `${directory}/${convert_filename_to_url(title)}`;
  // key = `https://jknm-osnutki.s3.eu-central-003.backblazeb2.com/${directory}/${convert_filename_to_url(title)}`;
  key = `${directory}/${convert_filename_to_url(title)}`;
  console.log("upload_file_to_b2", {
    directory,
    file_type,
    external_url,
    title,
    mime_type,
    key,
    bucket,
    crop_entry,
  });

  /* const client = new S3Client({
    region: env.NEXT_PUBLIC_AWS_REGION,
    endpoint: "https://s3.eu-central-003.backblazeb2.com",
  }); */

  // Check if the file already exists
  /* if (allow_overwrite !== "allow_overwrite") {
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
  } */

  const b2 = await B2.authorize({
    applicationKeyId: env.AWS_ACCESS_KEY_ID,
    applicationKey: env.AWS_SECRET_ACCESS_KEY,
  });

  const bucket_obj = await b2.bucket(bucket);
  if (typeof file !== "object" || !file) return NextResponse.error();

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await bucket_obj.upload(key, buffer, {
    contentType: mime_type,
    contentLength: 5 * 10485760, // up to 10 MB
  });

  let file_data: ImageUploadJSON | FileUploadJSON | undefined = undefined;

  const returned_url = `https://jknm-osnutki.s3.eu-central-003.backblazeb2.com/${key}`;
  if (file_type === "image") {
    const image_buffer = await file.arrayBuffer();
    const image_metadata = await sharp(image_buffer).metadata();
    const image_width = image_metadata.width;
    const image_height = image_metadata.height;

    file_data = {
      url: returned_url,
      width: image_width,
      height: image_height,
    };
  } else {
    file_data = {
      url: returned_url,
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
