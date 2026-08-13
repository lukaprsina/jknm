"use server";

import mime from "mime/lite";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type {
	FileUploadJSON,
	FileUploadResponse,
	ImageUploadJSON,
} from "~/lib/media-upload";
import { crop_image } from "~/lib/s3-utils";
import { thumbnail_validator } from "~/lib/validators";
import { getServerAuthSession } from "~/server/auth";
import {
	ExternalFetchTooLargeError,
	fetch_external_image,
	MAX_MEDIA_BYTES,
	UnsafeExternalUrlError,
} from "~/server/media/fetch-external-image";
import { ingest_media } from "~/server/media/ingest";

// Storage — bucket, key layout, variants, srcsets, blur placeholder — lives in
// `~/server/media/ingest`. Fetching+validating a client-supplied source url
// lives in `~/server/media/fetch-external-image`. What's left here is the
// HTTP shape: auth, decoding the multipart form, the optional crop, and
// EditorJS's response envelope.

export async function POST(request: NextRequest) {
	const session = await getServerAuthSession();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Reject oversized direct uploads before buffering the multipart body into
	// memory, rather than only after `ingest_media` gets a huge buffer handed
	// to it.
	const content_length = request.headers.get("content-length");
	if (content_length && Number(content_length) > MAX_MEDIA_BYTES) {
		return NextResponse.json({ error: "File too large" }, { status: 413 });
	}

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

		let fetched: Awaited<ReturnType<typeof fetch_external_image>>;
		try {
			fetched = await fetch_external_image(external_url);
		} catch (error) {
			if (
				error instanceof UnsafeExternalUrlError ||
				error instanceof ExternalFetchTooLargeError
			) {
				return NextResponse.json({ error: error.message }, { status: 400 });
			}
			throw error;
		}
		// The source's real content-type (from the fetch response) is
		// authoritative — `title` is often a synthetic placeholder (e.g. a
		// thumbnail crop's fixed "thumbnail.png") that doesn't reflect the
		// actual file type and previously caused every cropped thumbnail to be
		// stored as a `.png` no matter what format the source image really was.
		const mime_type = fetched.content_type || (mime.getType(title) ?? "image/jpeg");
		const real_extension = mime.getExtension(mime_type);
		if (real_extension) {
			const base_title = title.replace(/\.[^./]+$/, "");
			title = `${base_title}.${real_extension}`;
		}
		const uncropped_file = new File([fetched.bytes], title, {
			type: mime_type,
		});

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
			return NextResponse.json({ error: "Missing file" }, { status: 400 });
		}
	} else {
		return NextResponse.json(
			{ error: "Unrecognized file type" },
			{ status: 400 },
		);
	}

	if (typeof file !== "object" || !file) {
		return NextResponse.json({ error: "Invalid file" }, { status: 400 });
	}

	const media = await ingest_media({
		bytes: Buffer.from(await file.arrayBuffer()),
		filename: title,
		content_type:
			file.type || (mime.getType(title) ?? "application/octet-stream"),
	});

	const url = media.original.url;

	let file_data: ImageUploadJSON | FileUploadJSON;
	if (file_type === "image") {
		file_data = {
			url,
			width: media.original.width,
			height: media.original.height,
		};
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
