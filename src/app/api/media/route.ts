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
import { media_url } from "~/lib/media-upload";
import { crop_image } from "~/lib/s3-utils";
import { thumbnail_validator } from "~/lib/validators";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import type { MediaVariantData } from "~/server/db/schema";
import { Media } from "~/server/db/schema";

const VARIANT_WIDTHS = [400, 800, 1600];
const VARIANT_FORMATS = ["avif", "jpeg"] as const;
const BLUR_WIDTH = 16;

type Bucket = Awaited<ReturnType<B2["bucket"]>>;

async function generate_image_variants({
	buffer,
	original_width,
	id,
	bucket_obj,
}: {
	buffer: Buffer;
	original_width: number;
	id: string;
	bucket_obj: Bucket;
}) {
	const widths = VARIANT_WIDTHS.filter((width) => width < original_width);

	const variants: MediaVariantData[] = [];
	for (const width of widths) {
		for (const format of VARIANT_FORMATS) {
			const resized = sharp(buffer).resize({ width });
			const output_buffer = await (format === "avif"
				? resized.avif({ quality: 50 })
				: resized.jpeg({ quality: 75 })
			).toBuffer();
			const output_metadata = await sharp(output_buffer).metadata();

			const key = `${id}/${width}.${format}`;
			await bucket_obj.upload(key, output_buffer, {
				contentType: `image/${format}`,
				contentLength: output_buffer.byteLength,
			});

			variants.push({
				format,
				width,
				height: output_metadata.height ?? 0,
				url: media_url(key),
				size_bytes: output_buffer.byteLength,
			});
		}
	}

	const srcsets =
		variants.length > 0
			? {
					avif: variants
						.filter((v) => v.format === "avif")
						.map((v) => `${v.url} ${v.width}w`)
						.join(", "),
					jpeg: variants
						.filter((v) => v.format === "jpeg")
						.map((v) => `${v.url} ${v.width}w`)
						.join(", "),
					sizes: "(max-width: 800px) 100vw, 800px",
				}
			: undefined;

	const blur_buffer = await sharp(buffer)
		.resize({ width: BLUR_WIDTH })
		.jpeg({ quality: 40 })
		.toBuffer();
	const blur_placeholder = `data:image/jpeg;base64,${blur_buffer.toString("base64")}`;

	return { variants, srcsets, blur_placeholder };
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
		if (!title) title = "unknown_image.jpg";

		const url_image_response = await fetch(external_url);
		const blob = await url_image_response.blob();
		// The source's real content-type (from the fetch response) is
		// authoritative — `title` is often a synthetic placeholder (e.g. a
		// thumbnail crop's fixed "thumbnail.png") that doesn't reflect the
		// actual file type and previously caused every cropped thumbnail to be
		// stored as a `.png` no matter what format the source image really was.
		const mime_type = blob.type || mime.getType(title) || "image/jpeg";
		const real_extension = mime.getExtension(mime_type);
		if (real_extension) {
			const base_title = title.replace(/\.[^./]+$/, "");
			title = `${base_title}.${real_extension}`;
		}
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

	const mime_type =
		file.type || (mime.getType(title) ?? "application/octet-stream");
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
	let variants: MediaVariantData[] = [];
	let srcsets: { avif: string; jpeg: string; sizes: string } | undefined;
	let blur_placeholder: string | undefined;
	if (file_type === "image") {
		const image_metadata = await sharp(buffer).metadata();
		width = image_metadata.width;
		height = image_metadata.height;

		if (width) {
			const generated = await generate_image_variants({
				buffer,
				original_width: width,
				id,
				bucket_obj,
			});
			variants = generated.variants;
			srcsets = generated.srcsets;
			blur_placeholder = generated.blur_placeholder;
		}
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
		variants,
		srcsets,
		blur_placeholder,
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
