"use client";
/* eslint-disable @next/next/no-img-element -- ReactCrop clones a raw <img> ref; biome enforces the same rule. */

import Image from "next/image";
import type React from "react";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Crop } from "react-image-crop";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import { useEditorImageData } from "~/components/editor/editor-store";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { ThumbnailType } from "~/lib/validators";
import "react-image-crop/dist/ReactCrop.css";
import { PlusIcon, TrashIcon } from "lucide-react";
import { DraftArticleContext } from "~/components/article/context";
import { upload_image_by_file } from "~/components/aws-s3/upload-file";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { EditorJSImageData } from "~/lib/editor-utils";

export function ImageSelector({
	image: formImage,
	setImage: setFormImage,
}: {
	image: ThumbnailType | undefined;
	setImage: (image: ThumbnailType | undefined) => void;
}) {
	const draft_article = useContext(DraftArticleContext);
	const store_images = useEditorImageData();
	const input_ref = useRef<HTMLInputElement>(null);
	const [crop, setCrop] = useState<Crop>();
	const [uploadedVersion, setUploadedVersion] = useState<number>(() =>
		Date.now(),
	);
	const [customThumbnailExists, setCustomThumbnailExists] = useState<boolean>(
		formImage?.uploaded_custom_thumbnail ?? false,
	);
	// Media is immutable/decoupled (#8, #18): every upload gets a fresh URL,
	// so it's tracked directly instead of derived from a fixed draft-bucket key.
	const [customThumbnailUrl, setCustomThumbnailUrl] = useState<string>(
		formImage?.uploaded_custom_thumbnail ? (formImage.image_url ?? "") : "",
	);
	const [doCenterCrop, setDoCenterCrop] = useState<boolean>(false);
	const [selectedImageIndex, setSelectedImageIndex] = useState<
		number | undefined
	>(undefined);

	const images = useMemo(() => {
		const temp = [...store_images];

		if (customThumbnailExists && draft_article && customThumbnailUrl) {
			const editor_image = {
				file: {
					url: customThumbnailUrl,
				},
				caption: "",
			} satisfies EditorJSImageData;

			temp.push(editor_image);
		}

		return temp;
	}, [customThumbnailExists, customThumbnailUrl, draft_article, store_images]);

	// `crop` mirrors `formImage` (the source of truth), but ReactCrop also
	// writes into it directly as the user drags — so it can't be a plain
	// derived value, only re-synced when `formImage` itself changes.
	const [previousFormImage, setPreviousFormImage] = useState(formImage);
	if (formImage !== previousFormImage) {
		setPreviousFormImage(formImage);
		setCrop(formImage);
	}

	// Defaults to whichever image matches `formImage` until the user makes an
	// explicit selection (click), which then wins regardless of later prop changes.
	const imageIndex = useMemo(() => {
		if (typeof selectedImageIndex === "number") return selectedImageIndex;
		if (!formImage) return undefined;

		const index = images.findIndex(
			(image) => image.file.url === formImage.image_url,
		);

		return index === -1 ? undefined : index;
	}, [formImage, images, selectedImageIndex]);

	const handle_image_load = useCallback(
		(event: React.SyntheticEvent<HTMLImageElement>) => {
			const { naturalWidth: width, naturalHeight: height } =
				event.currentTarget;

			if (typeof imageIndex !== "number") return;
			const image_url = images[imageIndex]?.file.url;

			if (typeof image_url === "undefined") return;
			let current_crop: Crop | undefined;
			if (!doCenterCrop) {
				current_crop = crop;
			}

			current_crop ??= centerCrop(
				makeAspectCrop(
					{
						unit: "%",
						width: 100,
					},
					16 / 9,
					width,
					height,
				),
				width,
				height,
			);

			const thumbnail = {
				...current_crop,
				uploaded_custom_thumbnail: customThumbnailExists,
				image_url,
				unit: "%",
			} satisfies ThumbnailType;

			setDoCenterCrop(false);
			setFormImage(thumbnail);
		},
		[
			crop,
			customThumbnailExists,
			doCenterCrop,
			imageIndex,
			images,
			setFormImage,
		],
	);

	return (
		<>
			<input
				type="file"
				className="hidden"
				accept="image/*"
				ref={input_ref}
				onChange={async (event) => {
					const files = event.target.files;
					const file = files?.item(0);
					if (!file) return;

					setFormImage(undefined);
					setCustomThumbnailExists(false);

					const response = await upload_image_by_file({
						file,
						custom_title: "thumbnail-uploaded.png",
						crop: formImage,
					});

					if (
						typeof response.file === "undefined" ||
						!("width" in response.file)
					) {
						return;
					}

					setCustomThumbnailUrl(response.file.url);
					setCustomThumbnailExists(true);
					setUploadedVersion(Date.now());
				}}
			/>
			<div className="flex gap-4">
				<ScrollArea className="h-[65vh] overflow-y-auto py-4">
					<div className="flex flex-grow flex-wrap gap-2">
						{images.map((image, index) => {
							let width = image.file.width;
							let height = image.file.height;
							let is_custom_image = false;
							if (!image.file.url) {
								width = 0;
								height = 0;
							}

							if (
								customThumbnailExists &&
								image.file.url === customThumbnailUrl
							) {
								is_custom_image = true;
								width = 300;
								height = (300 * 9) / 16;
							}

							return (
								<Card
									// biome-ignore lint/suspicious/noArrayIndexKey: url alone isn't unique (custom thumbnail can repeat a store image's url)
									key={`${image.file.url}-${index}`}
									className={cn(
										"box-border flex cursor-pointer items-center justify-center border-2 p-2",
										imageIndex === index && "border-blue-500",
										"max-h-[300px] max-w-[300px]",
										"relative",
									)}
								>
									<Image
										src={`${image.file.url}?v=${uploadedVersion}`}
										alt={`Izbira slike #${index}`}
										width={width}
										height={height}
										className="h-full w-full rounded-sm object-contain"
										onClick={() => {
											setFormImage(undefined);
											setUploadedVersion(Date.now());
											setSelectedImageIndex(index);
											setDoCenterCrop(true);
										}}
									/>
									{is_custom_image && (
										<Button
											size="icon"
											variant="destructive"
											type="button"
											className="absolute right-0 top-0 m-4 shadow-2xl"
											onClick={() => {
												// Media is immutable (#8) — nothing to delete on B2,
												// just clear the local selection.
												setCustomThumbnailExists(false);
												setCustomThumbnailUrl("");
												setFormImage(undefined);
											}}
										>
											<TrashIcon />
										</Button>
									)}
								</Card>
							);
						})}
						<Card
							onClick={() => {
								if (!input_ref.current) return;
								input_ref.current.value = "";
								input_ref.current.click();
							}}
							className="box-border flex cursor-pointer items-center justify-center border-2 p-2"
						>
							<div className="w-[300px]">
								<AspectRatio
									ratio={16 / 9}
									className="flex h-full items-center justify-center"
								>
									<PlusIcon />
								</AspectRatio>
							</div>
						</Card>
					</div>
				</ScrollArea>
				{typeof imageIndex === "number" && images[imageIndex]?.file.url && (
					<div className="flex w-[500px] max-w-[500px] items-center justify-center">
						<ReactCrop
							className="w-full"
							onComplete={(_, percent_crop) => {
								if (!images[imageIndex]) return;

								setFormImage({
									...percent_crop,
									image_url: images[imageIndex].file.url,
									uploaded_custom_thumbnail: customThumbnailExists,
								});
							}}
							crop={crop}
							onChange={(pixelCrop) => {
								setCrop(pixelCrop);
							}}
							aspect={16 / 9}
							ruleOfThirds
							minHeight={50}
							minWidth={50}
						>
							{/* biome-ignore lint/performance/noImgElement: ReactCrop clones a raw <img> ref, incompatible with next/image */}
							<img
								src={`${images[imageIndex].file.url}?v=${uploadedVersion}`}
								alt="Obrezovanje slike"
								width={images[imageIndex].file.width}
								height={images[imageIndex].file.height}
								className="h-full w-full min-w-[500px] object-contain"
								onLoad={(event) => handle_image_load(event)}
							/>
						</ReactCrop>
					</div>
				)}
			</div>
		</>
	);
}
