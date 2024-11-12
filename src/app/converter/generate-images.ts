"use server";

import * as fs from "fs/promises";
import path from "path";
import sharp from "sharp";

const content_path = "C:/Users/luka/Documents/jknm-backup/slike_renamed";

type ImageSize = {
  width: number;
  height: number;
};

export async function generate_images() {
  const content_map = new Map<string, ImageSize>();

  const dirs = await fs.readdir(content_path, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) {
      continue;
    }

    const dir_path = path.join(content_path, dir.name);
    for await (const file of walk_dir(dir_path)) {
      const image = sharp(file);
      const { width, height } = await image.metadata();

      const relative_path = path.relative(content_path, file);
      if (!width || !height) {
        console.error(`Failed to get metadata for ${relative_path}`);
        continue;
      }

      content_map.set(relative_path.replaceAll("\\", "/"), { width, height });
    }
  }

  const cwd = process.cwd();
  const artifacts_dir = path.join(cwd, "artifacts");

  try {
    await fs.access(artifacts_dir);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: unknown) {
    await fs.mkdir(artifacts_dir, { recursive: true });
  }

  const image_sizes = Array.from(content_map.entries()).map(([path, size]) => ({
    path,
    size,
  }));
  const image_sizes_json = JSON.stringify(image_sizes, null, 2);
  const image_sizes_json_path = path.join(artifacts_dir, "image_sizes.json");
  await fs.writeFile(image_sizes_json_path, image_sizes_json);
}

async function* walk_dir(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk_dir(entry);
    else if (d.isFile()) yield entry;
  }
}
