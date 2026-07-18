"use client";

import type { ImageProps } from "next/image";
import Image from "next/image";
import { useEffect, useState } from "react";
import { gallery_store } from "~/components/gallery-store";
import type { EditorJSImageData } from "~/lib/editor-utils";
import image_sizes_json from "../../artifacts/image_sizes.json";

// AVIF siblings are generated out-of-band by
// `scripts/optimize-static-content-images.ts` (Vercel's built-in image
// optimization is unused here, see `next.config.mjs`'s `images.unoptimized`)
// — `has_avif` records which paths got one, so this cast just widens the
// JSON import's inferred literal type rather than requiring every entry to
// already carry the field.
interface ImageSizeEntry {
	path: string;
	size: { width: number; height: number };
	has_avif?: boolean;
}
const image_sizes = image_sizes_json as ImageSizeEntry[];

const CONTENT_DOMAIN = "vsebina.jknm.org";

interface ImageWithCaptionProps extends ImageProps {
	caption?: React.ReactNode;
}

export function ImageWithCaption({
	src,
	caption,
	...props
}: ImageWithCaptionProps) {
	const [imageData, setImageData] = useState<EditorJSImageData | undefined>(
		undefined,
	);

	useEffect(() => {
		if (typeof src !== "string") throw new Error("Image src should be string");

		const new_src = `https://${CONTENT_DOMAIN}/${src}`;
		const image_size = image_sizes.find((size) => size.path === src);
		if (!image_size) throw new Error("Image size not found");

		setImageData({
			file: {
				url: new_src,
				width: image_size.size.width,
				height: image_size.size.height,
			},
			caption: caption as string,
		});
	}, [caption, src]);

	useEffect(() => {
		if (!imageData) return;
		gallery_store.set("add_image", imageData);
	}, [imageData]);

	if (typeof src !== "string") throw new Error("Image src should be string");
	const image_size = image_sizes.find((size) => size.path === src);
	if (!image_size) throw new Error(`Image size not found for ${src}`);

	const new_src = `https://${CONTENT_DOMAIN}/${src}`;
	const avif_src = image_size.has_avif
		? new_src.replace(/\.[^./]+$/, ".avif")
		: undefined;

	return (
		<figure>
			<picture>
				{avif_src && <source srcSet={avif_src} type="image/avif" />}
				{/* TODO */}
				{/* eslint-disable-next-line jsx-a11y/alt-text */}
				<Image
					src={new_src}
					width={image_size.size.width}
					height={image_size.size.height}
					{...props}
					onClick={() => {
						if (!imageData) return;
						gallery_store.set("default_image", imageData);
					}}
				/>
			</picture>
			{caption && <figcaption>{caption}</figcaption>}
		</figure>
	);
}
