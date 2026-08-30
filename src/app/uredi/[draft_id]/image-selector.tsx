"use client";
/* eslint-disable @next/next/no-img-element -- ReactCrop clones a raw <img> ref; biome enforces the same rule. */

import { Loader2Icon, PlusIcon, TrashIcon } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import type { PercentCrop } from "react-image-crop";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useEditorImageData } from "~/components/editor/editor-store";
import { AspectRatio } from "~/components/ui/aspect-ratio";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { EditorJSImageData } from "~/lib/editor-utils";
import { cn } from "~/lib/utils";
import type { ThumbnailType } from "~/lib/validators";
import { create_thumbnail_store } from "./thumbnail-selection-store";

export function ImageSelector({
	image: formImage,
	setImage: setFormImage,
}: {
	image: ThumbnailType | undefined;
	setImage: (image: ThumbnailType | undefined) => void;
}) {
	const store_images = useEditorImageData();
	const input_ref = useRef<HTMLInputElement>(null);

	// Per-mount instance — this state lives and dies with the dialog, unlike
	// `gallery_store`, which is a deliberate singleton for a different reason
	// (registered piecemeal as a whole article body renders).
	const [use_thumbnail_store] = useState(() =>
		create_thumbnail_store(formImage),
	);
	const selected_url = use_thumbnail_store((s) => s.selected_url);
	const live_crop = use_thumbnail_store((s) => s.live_crop);
	const custom_thumbnail = use_thumbnail_store((s) => s.custom_thumbnail);
	const uploading = use_thumbnail_store((s) => s.uploading);
	const actions = use_thumbnail_store((s) => s.actions);

	const images = useMemo((): EditorJSImageData[] => {
		if (!custom_thumbnail) return store_images;

		const custom_image: EditorJSImageData = {
			file: { url: custom_thumbnail.url },
			caption: "",
		};

		return [...store_images, custom_image];
	}, [store_images, custom_thumbnail]);

	const selected_index = images.findIndex(
		(image) => image.file.url === selected_url,
	);
	const selected_image =
		selected_index === -1 ? undefined : images[selected_index];

	const is_selected_custom =
		custom_thumbnail !== null && custom_thumbnail.url === selected_url;

	function commit(crop: PercentCrop) {
		if (!selected_url) return;

		setFormImage({
			...crop,
			image_url: selected_url,
			uploaded_custom_thumbnail: is_selected_custom,
			unit: "%",
		});
	}

	function handle_crop_image_load(
		event: React.SyntheticEvent<HTMLImageElement>,
	) {
		const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
		const crop = actions.resolveCrop(width, height);
		if (crop) commit(crop);
	}

	return (
		<>
			<input
				type="file"
				className="hidden"
				accept="image/*"
				disabled={uploading}
				ref={input_ref}
				onChange={async (event) => {
					const file = event.target.files?.item(0);
					if (!file) return;

					setFormImage(undefined);

					const uploaded = await actions.uploadCustomThumbnail(file, formImage);
					if (!uploaded) return;

					actions.selectImage(uploaded.url);
				}}
			/>
			<div className="flex gap-4">
				<ScrollArea className="h-[65vh] overflow-y-auto py-4">
					<div className="flex flex-grow flex-wrap gap-2">
						{images.map((image, index) => {
							let width = image.file.width;
							let height = image.file.height;
							const is_custom_image =
								custom_thumbnail !== null &&
								image.file.url === custom_thumbnail.url;

							if (!image.file.url) {
								width = 0;
								height = 0;
							}
							if (is_custom_image) {
								width = 300;
								height = (300 * 9) / 16;
							}

							return (
								<Card
									// biome-ignore lint/suspicious/noArrayIndexKey: url alone isn't unique (custom thumbnail can repeat a store image's url)
									key={`${image.file.url}-${index}`}
									className={cn(
										"box-border flex cursor-pointer items-center justify-center border-2 p-2",
										index === selected_index && "border-blue-500",
										"max-h-[300px] max-w-[300px]",
										"relative",
									)}
								>
									<Image
										src={image.file.url}
										alt={`Izbira slike #${index}`}
										width={width}
										height={height}
										className="h-full w-full rounded-sm object-contain"
										onClick={() => {
											setFormImage(undefined);
											actions.selectImage(image.file.url);
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
												// just clear the local selection. Only clears the
												// form if the removed thumbnail was the selected one
												// — deleting an unselected custom thumbnail shouldn't
												// discard whatever else is currently selected.
												if (is_selected_custom) setFormImage(undefined);
												actions.removeCustomThumbnail();
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
								if (uploading || !input_ref.current) return;
								input_ref.current.value = "";
								input_ref.current.click();
							}}
							aria-disabled={uploading}
							className={cn(
								"box-border flex items-center justify-center border-2 p-2",
								uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer",
							)}
						>
							<div className="w-[300px]">
								<AspectRatio
									ratio={16 / 9}
									className="flex h-full items-center justify-center"
								>
									{uploading ? (
										<Loader2Icon className="animate-spin" />
									) : (
										<PlusIcon />
									)}
								</AspectRatio>
							</div>
						</Card>
					</div>
				</ScrollArea>
				{selected_image?.file.url && (
					<div className="flex w-[500px] max-w-[500px] items-center justify-center">
						<ReactCrop
							className="w-full"
							crop={live_crop}
							onChange={(_, percent_crop) => actions.setLiveCrop(percent_crop)}
							onComplete={(_, percent_crop) => {
								actions.commitCrop(percent_crop);
								commit(percent_crop);
							}}
							aspect={16 / 9}
							ruleOfThirds
							minHeight={50}
							minWidth={50}
						>
							{/* biome-ignore lint/performance/noImgElement: ReactCrop clones a raw <img> ref, incompatible with next/image */}
							<img
								src={selected_image.file.url}
								alt="Obrezovanje slike"
								width={selected_image.file.width}
								height={selected_image.file.height}
								className="h-full w-full min-w-[500px] object-contain"
								onLoad={handle_crop_image_load}
							/>
						</ReactCrop>
					</div>
				)}
			</div>
		</>
	);
}
