export interface Dimensions {
	width: number;
	height: number;
}

export interface ViewportBounds {
	maxWidth: number;
	maxHeight: number;
}

/**
 * Scales `natural` down to fit within `bounds`, preserving aspect ratio.
 * Never upscales past the natural size.
 */
export function fitToViewport(
	natural: Dimensions,
	bounds: ViewportBounds,
): Dimensions {
	const scale = Math.min(
		bounds.maxWidth / natural.width,
		bounds.maxHeight / natural.height,
		1,
	);

	return {
		width: Math.round(natural.width * scale),
		height: Math.round(natural.height * scale),
	};
}
