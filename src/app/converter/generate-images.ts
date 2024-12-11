"use server";

import fs_promises from "node:fs/promises";
import path from "path";
import sharp from "sharp";
import { db } from "~/server/db";
import { convert_filename_to_url } from "~/lib/article-utils";
import { PublishedArticle } from "~/server/db/schema";
import { eq } from "drizzle-orm";

// const content_path = "C:/Users/luka/Documents/jknm-backup/slike_renamed";
const content_path = "C:/Users/peter/Downloads/(static)_renamed";

type ImageSize = {
  width: number;
  height: number;
};

export async function rename_all_files() {
  console.log("Renaming all files");
  const articles = await db.query.PublishedArticle.findMany({
    limit: 50,
  });

  let images_count = 0;
  let link_count = 0;

  const getAllFiles = async (dirPath: string, arrayOfFiles: string[] = []) => {
    const files = await fs_promises.readdir(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs_promises.stat(filePath);

      if (stat.isDirectory()) {
        await getAllFiles(filePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(filePath);
      }
    }

    return arrayOfFiles;
  };

  const [all_files_0, all_files_1] = await Promise.all([
    getAllFiles("D:/JKNM/served/media/DK"),
    getAllFiles("D:/JKNM/served/media/pdf"),
  ]);
  const all_files = [...all_files_0, ...all_files_1].map((file) =>
    convert_filename_to_url(file),
  );
  console.log(all_files);

  const add_link = (text: string) => {
    const links = text.match(
      /https:\/\/jknm.s3.eu-central-1.amazonaws.com\/[^ ]+/g,
    );
    if (!links) return false;

    for (const link of links) {
      link_count++;
      const url_parts = link.split("/");
      const name = url_parts.at(-1);
      if (!name) throw new Error("No name");

      // const new_text = text.replace(link, name);
      // block.data.text = new_text;
      console.log("renamed", link, name);
      for (const file of all_files) {
        if (file.includes(name)) {
          console.log("found", { link, name, file });
          break;
        }
      }
    }

    return true;
  };

  for (const article of articles) {
    if (!article.content) throw new Error("No content");

    // https://jknm.s3.eu-central-1.amazonaws.com/kanin-2024-nm-5-sibaaaa-20-09-2024/slika_1.jpg
    for (const block of article.content.blocks) {
      switch (block.type) {
        case "image": {
          const data = block.data as { file: { url: string } };
          if (
            !data.file.url.startsWith(
              "https://jknm.s3.eu-central-1.amazonaws.com",
            )
          )
            throw new Error("Not jknm url");

          images_count++;
          const url_parts = data.file.url.split("/");
          const name = url_parts.at(-1);
          if (!name) throw new Error("No name");

          data.file.url = name;
          // console.log("renamed image", { from: data.file.url, to: name });

          break;
        }
        default: {
          if ("text" in block.data) {
            const text = block.data.text as string;
            add_link(text);
          }
        }
      }
    }
  }

  console.log("done", { images_count, link_count });
}

export async function generate_images() {
  const content_map = new Map<string, ImageSize>();

  const dirs = await fs_promises.readdir(content_path, { withFileTypes: true });
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
    await fs_promises.access(artifacts_dir);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: unknown) {
    await fs_promises.mkdir(artifacts_dir, { recursive: true });
  }

  const image_sizes = Array.from(content_map.entries()).map(([path, size]) => ({
    path,
    size,
  }));
  const image_sizes_json = JSON.stringify(image_sizes, null, 2);
  const image_sizes_json_path = path.join(artifacts_dir, "image_sizes.json");
  await fs_promises.writeFile(image_sizes_json_path, image_sizes_json);
}

async function* walk_dir(dir: string): AsyncGenerator<string> {
  for await (const d of await fs_promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk_dir(entry);
    else if (d.isFile()) yield entry;
  }
}

export async function rename_all_images_hardcoded() {
  const articles = await db.query.PublishedArticle.findMany({});

  articles.map((article) => {
    article.content?.blocks.map((block) => {
      if (block.type === "image") {
        const data = block.data as { file: { url: string } };
        const url_parts = data.file.url.split("/");
        const article_name = url_parts[url_parts.length - 2];
        const image_name = url_parts[url_parts.length - 1];
        const new_url = `https://jknm-novice.s3.eu-central-003.backblazeb2.com/${article_name}/${image_name}`;

        console.log("renamed image", { from: data.file.url, to: new_url });
        data.file.url = new_url;
      }

      return block;
    });
  });

  console.log("updating...");

  for (const article of articles) {
    await db
      .update(PublishedArticle)
      .set({ content: article.content })
      .where(eq(PublishedArticle.id, article.id));
  }

  console.log("Done");
}
