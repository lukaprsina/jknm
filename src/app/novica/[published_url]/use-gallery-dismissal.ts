"use client";

import type { RefObject } from "react";
import { useEffect } from "react";
import type { CarouselApi } from "~/components/ui/carousel";

/**
 * Owns everything about being a modal lightbox for as long as it's mounted:
 * Escape/wheel dismissal, body scroll-lock, and arrow/Home/End slide
 * navigation. Outside-click dismissal is handled separately by the caller via
 * a plain onClick on the backdrop (checking event.target === event.currentTarget)
 * since that doesn't need a window-level listener.
 */
export function useGalleryDismissal(
	emblaApi: CarouselApi | undefined,
	carousel_ref: RefObject<HTMLElement | null>,
	onDismiss: () => void,
): void {
	useEffect(() => {
		const original_overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const handle_keydown = (event: KeyboardEvent) => {
			switch (event.key) {
				case "Escape": {
					onDismiss();
					break;
				}
				case "ArrowLeft": {
					emblaApi?.scrollPrev();
					break;
				}
				case "ArrowRight": {
					emblaApi?.scrollNext();
					break;
				}
				case "Home": {
					emblaApi?.scrollTo(0);
					break;
				}
				case "End": {
					emblaApi?.scrollTo(emblaApi.slideNodes().length - 1);
					break;
				}
				default: {
					return;
				}
			}
			event.preventDefault();
		};

		// Ignore wheel/trackpad gestures that originate on the carousel itself
		// (image pan, swipe) — only a wheel over the backdrop should dismiss.
		const handle_wheel = (event: WheelEvent) => {
			if (
				event.target instanceof Node &&
				carousel_ref.current?.contains(event.target)
			) {
				return;
			}
			onDismiss();
		};

		window.addEventListener("keydown", handle_keydown);
		window.addEventListener("wheel", handle_wheel);

		return () => {
			document.body.style.overflow = original_overflow;
			window.removeEventListener("keydown", handle_keydown);
			window.removeEventListener("wheel", handle_wheel);
		};
	}, [emblaApi, carousel_ref, onDismiss]);
}
