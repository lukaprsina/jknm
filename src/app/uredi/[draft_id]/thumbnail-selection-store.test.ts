import { beforeEach, describe, expect, test, vi } from "vitest";
import {
	create_thumbnail_store,
	default_crop_for,
	type ThumbnailSeed,
} from "./thumbnail-selection-store";

const { upload_image_by_file } = vi.hoisted(() => ({
	upload_image_by_file: vi.fn(),
}));

vi.mock("~/components/aws-s3/upload-file", () => ({
	upload_image_by_file,
}));

beforeEach(() => {
	upload_image_by_file.mockReset();
});

function thumbnail(overrides: Partial<ThumbnailSeed> = {}): ThumbnailSeed {
	return {
		image_url: "a.png",
		unit: "%",
		x: 10,
		y: 10,
		width: 50,
		height: 50,
		...overrides,
	};
}

describe("initial state", () => {
	test("seeds from an existing thumbnail", () => {
		const store = create_thumbnail_store(thumbnail());
		const state = store.getState();

		expect(state.selected_url).toBe("a.png");
		expect(state.committed_crop).toMatchObject({ x: 10, y: 10 });
		expect(state.custom_thumbnail).toBeNull();
	});

	test("seeds custom_thumbnail when the existing thumbnail is a custom upload", () => {
		const store = create_thumbnail_store(
			thumbnail({ uploaded_custom_thumbnail: true, image_url: "custom.png" }),
		);

		expect(store.getState().custom_thumbnail).toEqual({ url: "custom.png" });
	});

	test("is empty with no existing thumbnail", () => {
		const store = create_thumbnail_store(undefined);
		const state = store.getState();

		expect(state.selected_url).toBeUndefined();
		expect(state.committed_crop).toBeUndefined();
		expect(state.custom_thumbnail).toBeNull();
	});
});

describe("selectImage / resolveCrop", () => {
	test("selecting a new image clears the crop until resolveCrop runs", () => {
		const store = create_thumbnail_store(thumbnail());
		store.getState().actions.selectImage("b.png");

		const state = store.getState();
		expect(state.selected_url).toBe("b.png");
		expect(state.committed_crop).toBeUndefined();
		expect(state.live_crop).toBeUndefined();
	});

	test("resolveCrop computes and commits a centered default for a freshly selected image", () => {
		const store = create_thumbnail_store(undefined);
		store.getState().actions.selectImage("b.png");

		const crop = store.getState().actions.resolveCrop(1600, 900);

		expect(crop).toEqual(default_crop_for(1600, 900));
		expect(store.getState().committed_crop).toEqual(crop);
		expect(store.getState().live_crop).toEqual(crop);
	});

	test("resolveCrop is a no-op when a crop is already committed (initial seed)", () => {
		const store = create_thumbnail_store(thumbnail());

		const crop = store.getState().actions.resolveCrop(1600, 900);

		expect(crop).toEqual(store.getState().committed_crop);
		expect(crop).not.toEqual(default_crop_for(1600, 900));
	});
});

describe("setLiveCrop / commitCrop", () => {
	test("setLiveCrop updates only the live crop", () => {
		const store = create_thumbnail_store(thumbnail());
		const before_committed = store.getState().committed_crop;

		store
			.getState()
			.actions.setLiveCrop({ unit: "%", x: 1, y: 2, width: 3, height: 4 });

		expect(store.getState().live_crop).toEqual({
			unit: "%",
			x: 1,
			y: 2,
			width: 3,
			height: 4,
		});
		expect(store.getState().committed_crop).toEqual(before_committed);
	});

	test("commitCrop updates both live and committed crop", () => {
		const store = create_thumbnail_store(undefined);
		const crop = { unit: "%" as const, x: 5, y: 5, width: 20, height: 20 };

		store.getState().actions.commitCrop(crop);

		expect(store.getState().live_crop).toEqual(crop);
		expect(store.getState().committed_crop).toEqual(crop);
	});
});

describe("uploadCustomThumbnail", () => {
	test("on success, sets custom_thumbnail and returns the url", async () => {
		upload_image_by_file.mockResolvedValue({
			success: 1,
			file: { url: "uploaded.png", width: 100, height: 56 },
		});
		const store = create_thumbnail_store(undefined);
		const file = new File([], "thumb.png");

		const result = await store
			.getState()
			.actions.uploadCustomThumbnail(file, undefined);

		expect(result).toEqual({ url: "uploaded.png" });
		expect(store.getState().custom_thumbnail).toEqual({ url: "uploaded.png" });
		expect(store.getState().uploading).toBe(false);
	});

	test("does not auto-select the uploaded image", async () => {
		upload_image_by_file.mockResolvedValue({
			success: 1,
			file: { url: "uploaded.png", width: 100, height: 56 },
		});
		const store = create_thumbnail_store(undefined);

		await store
			.getState()
			.actions.uploadCustomThumbnail(new File([], "thumb.png"), undefined);

		expect(store.getState().selected_url).toBeUndefined();
	});

	test("sets uploading true for the duration of the request", () => {
		let resolve_upload!: (value: unknown) => void;
		upload_image_by_file.mockReturnValue(
			new Promise((resolve) => {
				resolve_upload = resolve;
			}),
		);
		const store = create_thumbnail_store(undefined);

		const pending = store
			.getState()
			.actions.uploadCustomThumbnail(new File([], "thumb.png"), undefined);

		expect(store.getState().uploading).toBe(true);

		resolve_upload({ success: 1, file: { url: "x", width: 1, height: 1 } });
		return pending.then(() => {
			expect(store.getState().uploading).toBe(false);
		});
	});

	test("on failure (no file/no width), leaves custom_thumbnail untouched", async () => {
		upload_image_by_file.mockResolvedValue({ success: 0 });
		const store = create_thumbnail_store(
			thumbnail({ uploaded_custom_thumbnail: true, image_url: "existing.png" }),
		);

		const result = await store
			.getState()
			.actions.uploadCustomThumbnail(new File([], "thumb.png"), undefined);

		expect(result).toBeUndefined();
		expect(store.getState().custom_thumbnail).toEqual({ url: "existing.png" });
	});
});

describe("removeCustomThumbnail", () => {
	test("clears custom_thumbnail and the selection when the custom thumbnail was selected", () => {
		const store = create_thumbnail_store(
			thumbnail({ uploaded_custom_thumbnail: true, image_url: "custom.png" }),
		);

		store.getState().actions.removeCustomThumbnail();

		const state = store.getState();
		expect(state.custom_thumbnail).toBeNull();
		expect(state.selected_url).toBeUndefined();
		expect(state.committed_crop).toBeUndefined();
		expect(state.live_crop).toBeUndefined();
	});

	test("leaves the current selection alone when a different image is selected", () => {
		const store = create_thumbnail_store(
			thumbnail({ uploaded_custom_thumbnail: true, image_url: "custom.png" }),
		);
		store.getState().actions.selectImage("gallery.png");
		store.getState().actions.resolveCrop(1600, 900);

		store.getState().actions.removeCustomThumbnail();

		const state = store.getState();
		expect(state.custom_thumbnail).toBeNull();
		expect(state.selected_url).toBe("gallery.png");
		expect(state.committed_crop).toEqual(default_crop_for(1600, 900));
	});
});
