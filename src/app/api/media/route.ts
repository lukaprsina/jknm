"use server";

import B2 from "b2-js";
import mime from "mime/lite";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { env } from "~/env";
import { convert_filename_to_url } from "~/lib/article-utils";
import type {
	FileUploadJSON,
	FileUploadResponse,
	ImageUploadJSON,
} from "~/lib/media-upload";
import { MEDIA_PUBLIC_DOMAIN } from "~/lib/media-upload";
import { crop_image } from "~/lib/s3-utils";
import { thumbnail_validator } from "~/lib/validators";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { Media } from "~/server/db/schema";

function media_url(key: string) {
	return `https://${MEDIA_PUBLIC_DOMAIN}/${key}`;
}

export async function POST(request: NextRequest) {
	const session = await getServerAuthSession();
	if (!session) return NextResponse.error();

	const form_data = await request.formData();

	let file = form_data.get("file");
	const file_type = form_data.get("type");
	const external_url = form_data.get("url");
	const crop_entry = form_data.get("crop");
	let title = form_data.get("title");

	if (typeof title !== "string" && title !== null) {
		throw new Error("Title is not a string");
	}

	if (
		file_type === "image" &&
		typeof external_url === "string" &&
		typeof title === "string"
	) {
		let mime_type: string;
		if (!title) {
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
		} else {
			file = uncropped_file;
		}
	} else if (file_type === "image" || file_type === "file") {
		if (typeof file !== "string" && file) {
			if (typeof title !== "string") {
				title = file.name;
			}
		} else {
			return NextResponse.error();
		}
	} else {
		return NextResponse.error();
	}

	if (typeof file !== "object" || !file) return NextResponse.error();

	const mime_type = file.type || (mime.getType(title) ?? "application/octet-stream");
	const extension = mime.getExtension(mime_type) ?? "bin";
	const id = crypto.randomUUID();
	const key = `${id}/original.${extension}`;

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	const b2 = await B2.authorize({
		applicationKeyId: env.AWS_ACCESS_KEY_ID,
		applicationKey: env.AWS_SECRET_ACCESS_KEY,
	});
	const bucket_obj = await b2.bucket(env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME);

	await bucket_obj.upload(key, buffer, {
		contentType: mime_type,
		contentLength: 5 * 10485760,
	});

	const url = media_url(key);

	let width: number | undefined;
	let height: number | undefined;
	if (file_type === "image") {
		const image_metadata = await sharp(buffer).metadata();
		width = image_metadata.width;
		height = image_metadata.height;
	}

	await db.insert(Media).values({
		id,
		filename: convert_filename_to_url(title),
		content_type: mime_type,
		size_bytes: buffer.byteLength,
		original: {
			url,
			width: width ?? 0,
			height: height ?? 0,
			size_bytes: buffer.byteLength,
		},
		variants: [],
		upload_status: "completed",
	});

	let file_data: ImageUploadJSON | FileUploadJSON;
	if (file_type === "image") {
		file_data = { url, width, height };
	} else {
		file_data = {
			url,
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

	return NextResponse.json(response_json);
}
