"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { useGalleryImages } from "~/components/gallery-store";
import type { CarouselApi } from "~/components/ui/carousel";
import type { EditorJSImageData } from "~/lib/editor-utils";
import {
	decode_photo_param,
	encode_photo_param,
} from "~/lib/gallery-photo-param";

/**
 * The gallery's open/closed state lives in the URL (a `photo` query param
 * holding the open image's url, CDN-shortened by gallery-photo-param) rather
 * than in `gallery_store`, so that:
 * - navigating to a different page never carries a stale open image with it
 *   (the old bug: the URL for the new page simply has no `photo` param).
 * - opening pushes a history entry, so a phone/browser back gesture closes
 *   the gallery instead of leaving the page (see `closeGallery` below).
 */
const GALLERY_PARAM = "photo";

/**
 * True only when *this* page load pushed the currently-open `photo` entry
 * itself (via `useOpenGalleryImage`). Reset on every load, so a page landed
 * on directly with `?photo=...` already in the URL (shared link, reload
 * while open) starts `false` — there's no history entry we pushed to pop,
 * and calling `history.back()` in that case would navigate off this page
 * entirely, reintroducing the exact bug this file exists to fix.
 */
let opened_via_push = false;

export function useOpenImage(): EditorJSImageData | undefined {
	const [photo_param] = useQueryState(GALLERY_PARAM, parseAsString);
	const images = useGalleryImages();

	if (!photo_param) return undefined;
	const url = decode_photo_param(photo_param);
	return images.find((image) => image.file.url === url);
}

export function useOpenGalleryImage(): (image: EditorJSImageData) => void {
	const [, setPhoto] = useQueryState(GALLERY_PARAM, parseAsString);

	return (image) => {
		opened_via_push = true;
		void setPhoto(encode_photo_param(image.file.url), { history: "push" });
	};
}

/**
 * Keeps the `photo` param pointed at whatever slide the carousel is
 * currently on, so a swipe (not just the initial open) is reflected in the
 * url — reloading or sharing mid-browse lands on the photo actually being
 * viewed. Uses `history: "replace"` (nuqs's default) so swiping never grows
 * the back-stack; `closeGallery`'s single pushed entry from open is still
 * the only thing a back gesture pops.
 */
export function useSyncSelectedImage(
	emblaApi: CarouselApi,
	images: EditorJSImageData[],
): void {
	const [, setPhoto] = useQueryState(GALLERY_PARAM, parseAsString);

	useEffect(() => {
		if (!emblaApi) return;

		const handle_select = () => {
			const image = images[emblaApi.selectedScrollSnap()];
			if (image) void setPhoto(encode_photo_param(image.file.url));
		};

		emblaApi.on("select", handle_select);
		return () => {
			emblaApi.off("select", handle_select);
		};
	}, [emblaApi, images, setPhoto]);
}

/**
 * Every dismissal path (close button, Escape, outside click, wheel) goes
 * through this instead of clearing the `photo` param directly, so opening
 * always costs exactly one history entry and closing always consumes
 * exactly one — no dangling forward entries left after a UI-button close.
 * Falls back to clearing the param in place when we didn't push it
 * ourselves (see `opened_via_push`); nuqs's history patch (confirmed in
 * `node_modules/nuqs/dist/patch-history-*.js`) syncs its state for any
 * `history.replaceState` call, not just its own, so this stays in sync.
 */
export function closeGallery(): void {
	if (opened_via_push) {
		opened_via_push = false;
		window.history.back();
		return;
	}

	const url = new URL(window.location.href);
	url.searchParams.delete(GALLERY_PARAM);
	window.history.replaceState(null, "", url);
}
