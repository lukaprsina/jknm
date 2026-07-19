"use server";

import {
	DeleteObjectsCommand,
	ListObjectsV2Command,
	S3Client,
} from "@aws-sdk/client-s3";
import type { PercentCrop } from "react-image-crop";

/* TODO: CRITICAL, SHARP */
import sharp from "sharp";

import { env } from "~/env";

export async function list_objects(bucket: string, prefix: string) {
	try {
		const client = new S3Client({
			region: env.NEXT_PUBLIC_AWS_REGION,
			endpoint: "https://s3.eu-central-003.backblazeb2.com",
		});
		const response = await client.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
			}),
		);

		return response.Contents;
	} catch (error) {
		console.error("Error listing objects:", error);
		throw error;
	}
}

export async function delete_objects(bucket: string, keys: string[]) {
	try {
		const client = new S3Client({
			region: env.NEXT_PUBLIC_AWS_REGION,
			endpoint: "https://s3.eu-central-003.backblazeb2.com",
		});
		return await client.send(
			new DeleteObjectsCommand({
				Bucket: bucket,
				Delete: { Objects: keys.map((Key) => ({ Key })) },
			}),
		);
	} catch (error) {
		console.error("Error listing objects:", error);
		throw error;
	}
}

export async function crop_image(file: File, crop: PercentCrop): Promise<File> {
	// console.log("crop image", { file, crop });

	const image_buffer = await file.arrayBuffer();
	const sharp_image = sharp(image_buffer);
	const metadata = await sharp_image.metadata();

	if (!metadata.width || !metadata.height) {
		throw new Error("Unable to retrieve image dimensions");
	}

	const originalWidth = metadata.width;
	const originalHeight = metadata.height;

	// Convert percentage crop values to pixels
	const cropX = Math.round((crop.x / 100) * originalWidth);
	const cropY = Math.round((crop.y / 100) * originalHeight);
	const cropWidth = Math.round((crop.width / 100) * originalWidth);
	const cropHeight = Math.round((crop.height / 100) * originalHeight);

	// console.log("crop image", { cropX, cropY, cropWidth, cropHeight });
	const cropped_buffer = await sharp_image
		.extract({
			left: cropX,
			top: cropY,
			width: cropWidth,
			height: cropHeight,
		})
		.toBuffer();

	return new File([new Uint8Array(cropped_buffer)], file.name, {
		type: file.type,
	});
}
