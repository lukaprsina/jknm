import type { PercentCrop } from "react-image-crop";
import { centerCrop, makeAspectCrop } from "react-image-crop";
import { create } from "zustand";
import { upload_image_by_file } from "~/components/aws-s3/upload-file";

const THUMBNAIL_ASPECT = 16 / 9;

/**
 * A previously-committed thumbnail, in this store's own vocabulary — a crop
 * plus which image it belongs to. Deliberately not `ThumbnailType`: the store
 * doesn't know the form's validator type exists (structurally compatible
 * with it, so callers can pass a `ThumbnailType` value as-is).
 */
export interface ThumbnailSeed extends PercentCrop {
	image_url: string;
	uploaded_custom_thumbnail?: boolean;
}

export function default_crop_for(width: number, height: number): PercentCrop {
	return centerCrop(
		makeAspectCrop({ unit: "%", width: 100 }, THUMBNAIL_ASPECT, width, height),
		width,
		height,
	);
}

export interface ThumbnailStoreState {
	selected_url: string | undefined;
	live_crop: PercentCrop | undefined;
	committed_crop: PercentCrop | undefined;
	custom_thumbnail: { url: string } | null;
	uploading: boolean;
}

export interface ThumbnailStoreActions {
	/** User clicked a gallery image — clears any crop so `resolveCrop` computes a fresh default. */
	selectImage: (url: string) => void;
	/**
	 * Called from the cropper `<img>`'s onLoad with its real natural size. A
	 * no-op if a crop is already committed (the initially-seeded selection),
	 * otherwise computes and commits a centered default crop.
	 */
	resolveCrop: (width: number, height: number) => PercentCrop | undefined;
	/** Drag-in-progress crop, from ReactCrop's onChange. */
	setLiveCrop: (crop: PercentCrop) => void;
	/** Persisted crop, from ReactCrop's onComplete. */
	commitCrop: (crop: PercentCrop) => void;
	uploadCustomThumbnail: (
		file: File,
		crop: PercentCrop | undefined,
	) => Promise<{ url: string } | undefined>;
	removeCustomThumbnail: () => void;
}

export type ThumbnailStore = ThumbnailStoreState & {
	actions: ThumbnailStoreActions;
};

export function create_thumbnail_store(initial: ThumbnailSeed | undefined) {
	return create<ThumbnailStore>((set, get) => ({
		selected_url: initial?.image_url,
		live_crop: initial,
		committed_crop: initial,
		custom_thumbnail: initial?.uploaded_custom_thumbnail
			? { url: initial.image_url }
			: null,
		uploading: false,
		actions: {
			selectImage: (url) =>
				set({
					selected_url: url,
					live_crop: undefined,
					committed_crop: undefined,
				}),
			resolveCrop: (width, height) => {
				const existing = get().committed_crop;
				if (existing) return existing;

				const crop = default_crop_for(width, height);
				set({ live_crop: crop, committed_crop: crop });
				return crop;
			},
			setLiveCrop: (crop) => set({ live_crop: crop }),
			commitCrop: (crop) => set({ live_crop: crop, committed_crop: crop }),
			uploadCustomThumbnail: async (file, crop) => {
				set({ uploading: true });
				const response = await upload_image_by_file({
					file,
					custom_title: "thumbnail-uploaded.png",
					crop,
				});
				set({ uploading: false });

				if (
					typeof response.file === "undefined" ||
					!("width" in response.file)
				) {
					return undefined;
				}

				const url = response.file.url;
				set({ custom_thumbnail: { url } });
				return { url };
			},
			removeCustomThumbnail: () => {
				const { custom_thumbnail, selected_url } = get();
				const was_selected =
					custom_thumbnail !== null && selected_url === custom_thumbnail.url;

				set({
					custom_thumbnail: null,
					...(was_selected && {
						selected_url: undefined,
						live_crop: undefined,
						committed_crop: undefined,
					}),
				});
			},
		},
	}));
}
