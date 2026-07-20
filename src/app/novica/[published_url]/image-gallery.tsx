"use client";

import { XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gallery_store, useGalleryImages, useOpenImage } from "~/components/gallery-store";
import { Button } from "~/components/ui/button";
import type { CarouselApi } from "~/components/ui/carousel";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "~/components/ui/carousel";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import type { EditorJSImageData } from "~/lib/editor-utils";
import { fitToViewport } from "~/lib/fit-to-viewport";
import { cn } from "~/lib/utils";
import { useGalleryDismissal } from "./use-gallery-dismissal";

export function ImageGallery() {
	const open_image = useOpenImage();

	return open_image ? <GalleryPortal open_image={open_image} /> : null;
}

function GalleryPortal({ open_image }: { open_image: EditorJSImageData }) {
	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-around bg-black/90 backdrop-blur-sm md:p-10"
			onClick={(event) => {
				if (event.target === event.currentTarget) {
					gallery_store.getState().closeGallery();
				}
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") gallery_store.getState().closeGallery();
			}}
		>
			<MyCarousel open_image={open_image} />
		</div>,
		document.body,
	);
}

function MyCarousel({ open_image }: { open_image: EditorJSImageData }) {
	const images = useGalleryImages();
	const [emblaApi, setEmblaApi] = useState<CarouselApi>();
	const md_breakpoint = useBreakpoint("md", true);
	const container_ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!emblaApi) return;

		const index = images.findIndex(
			(image) => image.file.url === open_image.file.url,
		);
		if (index >= 0) emblaApi.scrollTo(index, true);
	}, [emblaApi, open_image, images]);

	useGalleryDismissal(emblaApi, () => gallery_store.getState().closeGallery());

	return (
		<Carousel
			ref={container_ref}
			setApi={setEmblaApi}
			opts={{
				align: "center",
				duration: 0,
			}}
			className="pointer-events-none flex h-full min-h-[350px] w-full items-center justify-center md:max-w-[80%]"
		>
			{/*
			 * Carousel's own box is pointer-events-none (see className above) so
			 * clicks in the empty backdrop margins around it fall through to the
			 * dialog root's outside-click handler. CarouselContent re-enables
			 * pointer events for the actual carousel viewport (needed for embla's
			 * drag/swipe listeners), which its descendants (items, image) inherit.
			 */}
			<CarouselContent className="pointer-events-auto">
				{images.map((image) => (
					<CarouselItem
						className="flex items-center justify-center"
						key={image.file.url}
					>
						<GalleryImage image={image} />
					</CarouselItem>
				))}
			</CarouselContent>
			{md_breakpoint && (
				<>
					<CarouselPrevious className="pointer-events-auto" />
					<CarouselNext className="pointer-events-auto" />
					<CloseButton className="pointer-events-auto -right-12 top-0 -translate-y-1/2" />
				</>
			)}
			{!md_breakpoint && (
				<CloseButton className="pointer-events-auto right-0 top-0 m-4" />
			)}
		</Carousel>
	);
}

function CloseButton({ className }: { className?: string }) {
	return (
		<Button
			variant="outline"
			size="icon"
			className={cn(className, "absolute h-8 w-8 rounded-full")}
			onClick={() => gallery_store.getState().closeGallery()}
		>
			<XIcon />
			<span className="sr-only">Zapri</span>
		</Button>
	);
}

const GALLERY_IMAGE_BOUNDS = { maxWidth: 1920, maxHeight: 1080 };
// Leaves room below the image for the caption and surrounding chrome so the
// image never gets clipped by the viewport edge.
const CAPTION_RESERVE_PX = 96;

function GalleryImage({ image }: { image: EditorJSImageData }) {
	const natural = {
		width: image.file.width ?? 1500,
		height: image.file.height ?? 1000,
	};
	const { width, height } = fitToViewport(natural, GALLERY_IMAGE_BOUNDS);

	return (
		<figure className="mx-auto grid w-full justify-items-center gap-2 md:max-w-[90vw]">
			<Image
				className="rounded-xl"
				src={image.file.url}
				alt={image.caption || "Slika"}
				width={width}
				height={height}
				style={{
					maxWidth: "100%",
					maxHeight: `calc(100dvh - ${CAPTION_RESERVE_PX}px)`,
					width: "auto",
					height: "auto",
					objectFit: "contain",
				}}
			/>
			{image.caption && (
				<figcaption className="rounded-xl text-center text-white">
					{image.caption}
				</figcaption>
			)}
		</figure>
	);
}
