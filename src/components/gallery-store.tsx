"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { EditorJSImageData } from "~/lib/editor-utils";

interface GalleryState {
	images: EditorJSImageData[];
}

interface GalleryActions {
	/** Full replace — used by callers that already compute their complete image set up front. */
	registerImages: (images: EditorJSImageData[]) => void;
	/** Dedup-by-url append — used by callers that register one image at a time as they render. */
	addImage: (image: EditorJSImageData) => void;
	removeImage: (url: string) => void;
}

type GalleryStore = GalleryState & GalleryActions;

function dedupe_by_url(images: EditorJSImageData[]): EditorJSImageData[] {
	const seen = new Set<string>();
	return images.filter((image) => {
		if (seen.has(image.file.url)) return false;
		seen.add(image.file.url);
		return true;
	});
}

export const gallery_store = create<GalleryStore>((set, get) => ({
	images: [],
	registerImages: (images) => set({ images: dedupe_by_url(images) }),
	addImage: (image) => {
		if (get().images.some((existing) => existing.file.url === image.file.url))
			return;
		set((state) => ({ images: [...state.images, image] }));
	},
	removeImage: (url) =>
		set((state) => ({
			images: state.images.filter((image) => image.file.url !== url),
		})),
}));

export function useGalleryImages(): EditorJSImageData[] {
	return gallery_store((state) => state.images);
}

/**
 * Registers a single image into the gallery on mount and removes exactly that
 * image on unmount — for callers (like MDX content) that render images one at
 * a time and never have the full set up front, so `registerImages` isn't an
 * option. Keeps the leak-across-navigation fix (unmount removes what mounted)
 * without requiring an upfront full-list computation.
 */
export function useRegisterGalleryImage(
	image: EditorJSImageData | undefined,
): void {
	useEffect(() => {
		if (!image) return;

		gallery_store.getState().addImage(image);
		return () => gallery_store.getState().removeImage(image.file.url);
	}, [image]);
}
