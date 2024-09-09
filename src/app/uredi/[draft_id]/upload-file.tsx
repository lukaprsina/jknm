// "use client";

import mime from "mime/lite";

import type { FileUploadResponse } from "~/app/api/upload_file_to_s3/route";
import { editor_store } from "~/components/editor/editor-store";

export async function upload_file(file: File): Promise<FileUploadResponse> {
  const article_url = editor_store.get.url();

  if (!article_url) {
    return {
      success: 0,
    };
  }

  const form_data = new FormData();
  form_data.append("file", file);
  form_data.append("directory", article_url);
  form_data.append("type", "file");

  const file_data = await fetch("/api/upload_file_to_s3", {
    method: "POST",
    body: form_data,
  });

  return await parse_s3_response(file_data /* novica_url, file.name, toast */);
}

// toast: ReturnType<typeof useToast>,
export async function upload_image_by_file(
  file: File,
): Promise<FileUploadResponse> {
  const article_url = editor_store.get.url();

  if (!article_url) {
    return {
      success: 0,
    };
  }

  const file_mime = mime.getType(file.name);
  if (!file_mime?.includes("image")) {
    console.warn("Wrong MIME type", file_mime);
    return {
      success: 0,
    };
  }

  const form_data = new FormData();
  form_data.append("file", file);
  form_data.append("directory", article_url);
  form_data.append("type", "image");

  const file_data = await fetch("/api/upload_file_to_s3", {
    method: "POST",
    body: form_data,
  });

  return await parse_s3_response(file_data /* novica_url, file.name, toast */);
}

// toast: ReturnType<typeof useToast>,
export async function upload_image_by_url(
  url: string,
): Promise<FileUploadResponse> {
  const article_url = editor_store.get.url();
  const title = url.split("/").pop();

  if (!title || !article_url) {
    console.error("Image doesn't have a title", url);
    return {
      success: 0,
    };
  }

  const form_data = new FormData();
  form_data.append("url", url);
  form_data.append("title", title);
  form_data.append("directory", article_url);
  form_data.append("type", "image");

  const file_data = await fetch("/api/upload_file_to_s3", {
    method: "POST",
    body: form_data,
  });

  return await parse_s3_response(file_data /* novica_url, title, toast */);
}

export async function parse_s3_response(
  file_data: Response,
  /* novica_url: string,
  filename: string,
  toast: ReturnType<typeof useToast>, */
): Promise<FileUploadResponse> {
  const error_response = {
    success: 0,
  } as const;

  const file_json = (await file_data.json()) as FileUploadResponse;

  /* function InsertImageToast() {
    return (
      <ToastAction
        altText="Vstavi sliko"
        onClick={() => {
          const image_data = settings_store.get.image_data();

          const found_image = image_data.find((image) => {
            const url_split = image.url.split("/");
            const image_name = url_split[url_split.length - 1];
            console.log({ image_name, filename });

            return image_name === filename;
          });

          if (!found_image) {
            console.error("Image not found", filename);
            return;
          }

          console.log("inserting image", found_image, editor);

          return {
            success: 1,
            file: found_image,
          };
        }}
      >
        Vstavi sliko
      </ToastAction>
    );
  } */

  if (file_data.ok) {
    if (file_json.error == "File exists") {
      console.log("File exists", file_json);
      /* toast.toast({
        title: "Slika s takim imenom že obstaja",
        description: `Novica: ${novica_url}, ime: ${filename}`,
        // action: <InsertImageToast />, // TODO, maybe alert better
      }); */

      return {
        success: 0,
        error: "File exists",
      };
    }

    return {
      success: 1,
      file: file_json.file,
    };
  } else {
    console.error("Error uploading file: !file_data.ok", file_data);
    return error_response;
  }
}
