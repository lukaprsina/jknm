import sharp from "sharp";
import { describe, expect, test, vi } from "vitest";
import { create_test_db } from "~/server/db/test-helpers";
import type { IngestMediaDeps } from "./ingest";
import { ingest_media } from "./ingest";

function make_fake_b2() {
	const upload = vi.fn().mockResolvedValue(undefined);
	const bucket = vi.fn().mockResolvedValue({ upload });
	const b2 = { bucket } as unknown as NonNullable<IngestMediaDeps["b2"]>;
	return { b2, bucket, upload };
}

async function png_bytes(fill: { r: number; g: number; b: number }) {
	return sharp({
		create: { width: 4, height: 4, channels: 3, background: fill },
	})
		.png()
		.toBuffer();
}

describe("ingest_media", () => {
	test("reuses the existing row when bytes hash-match a prior upload", async () => {
		const db = await create_test_db();
		const fake_b2 = make_fake_b2();
		const bytes = await png_bytes({ r: 10, g: 20, b: 30 });

		const first = await ingest_media(
			{ bytes, filename: "a.png", content_type: "image/png" },
			{ tx: db, b2: fake_b2.b2 },
		);
		expect(fake_b2.upload).toHaveBeenCalled();

		fake_b2.upload.mockClear();
		fake_b2.bucket.mockClear();

		const second = await ingest_media(
			{ bytes, filename: "b-different-name.png", content_type: "image/png" },
			{ tx: db, b2: fake_b2.b2 },
		);

		expect(second.id).toBe(first.id);
		expect(fake_b2.bucket).not.toHaveBeenCalled();
		expect(fake_b2.upload).not.toHaveBeenCalled();

		const rows = await db.query.Media.findMany();
		expect(rows).toHaveLength(1);
	});

	test("ingests distinct bytes as separate rows", async () => {
		const db = await create_test_db();
		const fake_b2 = make_fake_b2();

		const first = await ingest_media(
			{
				bytes: await png_bytes({ r: 1, g: 2, b: 3 }),
				filename: "a.png",
				content_type: "image/png",
			},
			{ tx: db, b2: fake_b2.b2 },
		);
		const second = await ingest_media(
			{
				bytes: await png_bytes({ r: 200, g: 100, b: 50 }),
				filename: "b.png",
				content_type: "image/png",
			},
			{ tx: db, b2: fake_b2.b2 },
		);

		expect(second.id).not.toBe(first.id);
		const rows = await db.query.Media.findMany();
		expect(rows).toHaveLength(2);
	});

	test("concurrent ingests of identical bytes still produce a single row", async () => {
		const db = await create_test_db();
		const fake_b2 = make_fake_b2();
		const bytes = await png_bytes({ r: 42, g: 99, b: 7 });
		const input = { bytes, filename: "a.png", content_type: "image/png" };

		const [first, second] = await Promise.all([
			ingest_media(input, { tx: db, b2: fake_b2.b2 }),
			ingest_media(input, { tx: db, b2: fake_b2.b2 }),
		]);

		expect(second.id).toBe(first.id);
		const rows = await db.query.Media.findMany();
		expect(rows).toHaveLength(1);
	});

	test("stores the sha256 hash of the uploaded bytes", async () => {
		const db = await create_test_db();
		const fake_b2 = make_fake_b2();
		const bytes = await png_bytes({ r: 5, g: 6, b: 7 });

		const media = await ingest_media(
			{ bytes, filename: "a.png", content_type: "image/png" },
			{ tx: db, b2: fake_b2.b2 },
		);

		expect(media.hash).toMatch(/^[0-9a-f]{64}$/);
	});
});
