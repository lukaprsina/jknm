// "use client";

import mime from "mime/lite";
import type { PercentCrop } from "react-image-crop";
import type { FileUploadResponse } from "~/lib/media-upload";

export async function upload_file({
	file,
}: {
	file: File;
}): Promise<FileUploadResponse> {
	const form_data = new FormData();
	form_data.append("file", file);
	form_data.append("type", "file");

	const file_data = await fetch("/api/media", {
		method: "POST",
		body: form_data,
	});

	return await parse_s3_response(file_data);
}

export async function upload_image_by_file({
	file,
	custom_title,
	crop,
}: {
	file: File;
	custom_title?: string;
	crop?: PercentCrop;
}): Promise<FileUploadResponse> {
	const file_mime = mime.getType(file.name);
	if (!file_mime?.includes("image")) {
		console.error("Wrong MIME type", file_mime);
		return {
			success: 0,
		};
	}

	const form_data = new FormData();
	form_data.append("file", file);
	form_data.append("type", "image");

	if (custom_title) {
		form_data.append("title", custom_title);
	}
	if (crop) {
		form_data.append("crop", JSON.stringify(crop));
	}

	const file_data = await fetch("/api/media", {
		method: "POST",
		body: form_data,
	});

	return await parse_s3_response(file_data);
}

export async function upload_image_by_url({
	url,
	custom_title,
	crop,
}: {
	url: string;
	custom_title?: string;
	crop?: PercentCrop;
}): Promise<FileUploadResponse> {
	let title = custom_title;
	title ??= url.split("/").pop();

	if (!title) {
		console.error("Image doesn't have a title", url);
		return {
			success: 0,
		};
	}

	const form_data = new FormData();
	form_data.append("url", url);
	form_data.append("title", title);
	form_data.append("type", "image");

	if (crop) {
		form_data.append("crop", JSON.stringify(crop));
	}

	const file_data = await fetch("/api/media", {
		method: "POST",
		body: form_data,
	});

	return await parse_s3_response(file_data);
}

export async function parse_s3_response(
	file_data: Response,
): Promise<FileUploadResponse> {
	const error_response = {
		success: 0,
	} as const;

	if (file_data.ok) {
		const file_json = (await file_data.json()) as FileUploadResponse;

		return {
			success: 1,
			file: file_json.file,
		};
	} else {
		const error_json: unknown = await file_data.json().catch(() => undefined);
		console.error("Error uploading file:", file_data.status, error_json);
		return error_response;
	}
}
