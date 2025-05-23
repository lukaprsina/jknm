// "use client";

import mime from "mime/lite";

import type { FileUploadResponse } from "~/app/api/upload_file_to_b2/route";
import type { PercentCrop } from "react-image-crop";

export async function upload_file({
  file,
  allow_overwrite,
  draft,
  directory,
}: {
  file: File;
  allow_overwrite?: "allow_overwrite";
  draft: boolean;
  directory: string;
}): Promise<FileUploadResponse> {
  // console.log("upload_file", file);
  // const directory = editor_store.get.draft_id().toString();

  if (!directory) {
    return {
      success: 0,
    };
  }

  const form_data = new FormData();
  form_data.append("file", file);
  form_data.append("directory", directory);
  form_data.append("type", "file");
  form_data.append("bucket", draft ? "draft" : "published");

  if (allow_overwrite === "allow_overwrite") {
    form_data.append("allow_overwrite", allow_overwrite);
  }

  const file_data = await fetch("/api/upload_file_to_b2", {
    method: "POST",
    body: form_data,
  });

  return await parse_s3_response(file_data /* novica_url, file.name, toast */);
}

export async function upload_image_by_file({
  file,
  custom_title,
  crop,
  allow_overwrite,
  draft,
  directory,
  // toast,
}: {
  file: File;
  custom_title?: string;
  crop?: PercentCrop;
  allow_overwrite?: "allow_overwrite";
  draft: boolean;
  directory: string;
  // toast: ReturnType<typeof useToast>,
}): Promise<FileUploadResponse> {
  // console.log("upload_image_by_file", file);
  /* const directory = draft
    ? editor_store.get.draft_id().toString()
    : editor_store.get.url(); */

  if (!directory) {
    console.error("No directory", directory);
    return {
      success: 0,
    };
  }

  const file_mime = mime.getType(file.name);
  if (!file_mime?.includes("image")) {
    console.error("Wrong MIME type", file_mime);
    return {
      success: 0,
    };
  }

  const form_data = new FormData();
  form_data.append("file", file);
  form_data.append("directory", directory);
  form_data.append("type", "image");
  form_data.append("bucket", draft ? "draft" : "published");

  if (allow_overwrite === "allow_overwrite") {
    form_data.append("allow_overwrite", allow_overwrite);
  }
  if (custom_title) {
    form_data.append("title", custom_title);
  }
  if (crop) {
    form_data.append("crop", JSON.stringify(crop));
  }

  const file_data = await fetch("/api/upload_file_to_b2", {
    method: "POST",
    body: form_data,
  });

  // console.log("got file_data", file_data);

  const response = await parse_s3_response(
    file_data /* novica_url, file.name, toast */,
  );
  // console.log("parsed s3 response", response);
  return response;
}

export async function upload_image_by_url({
  url,
  custom_title,
  crop,
  allow_overwrite,
  draft,
  directory,
}: {
  url: string;
  custom_title?: string;
  crop?: PercentCrop;
  allow_overwrite?: "allow_overwrite";
  draft: boolean;
  directory: string;
}): Promise<FileUploadResponse> {
  // toast: ReturnType<typeof useToast>,
  // const directory = editor_store.get.draft_id().toString();

  if (!directory) {
    console.error("No directory", directory);
    return {
      success: 0,
    };
  }

  let title = custom_title;
  if (!title) {
    title = url.split("/").pop();
  }

  if (!title) {
    console.error("Image doesn't have a title", url);
    return {
      success: 0,
    };
  }

  const form_data = new FormData();
  form_data.append("url", url);
  form_data.append("title", title);
  form_data.append("directory", directory);
  form_data.append("type", "image");
  form_data.append("bucket", draft ? "draft" : "published");

  if (allow_overwrite === "allow_overwrite") {
    form_data.append("allow_overwrite", allow_overwrite);
  }
  if (crop) {
    form_data.append("crop", JSON.stringify(crop));
  }

  const file_data = await fetch("/api/upload_file_to_b2", {
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
    const file_json = (await file_data.json()) as FileUploadResponse;

    if (file_json.error == "File exists") {
      // console.log("File exists", file_json);
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
