"use server";

import path from "path";
import fs from "node:fs";
import fs_promises from "node:fs/promises";
import { asc, sql } from "drizzle-orm";
import sharp from "sharp";

import type {
  ConverterArticleWithAuthorIds,
  DimensionType,
  FilesToSave,
} from "./converter-spaghetti";
import type { AuthorType } from "./get-authors";
import { db } from "~/server/db";
import {
  Author,
  DraftArticle,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";
import { crop_image, delete_s3_directory } from "~/server/s3-utils";
import { env } from "~/env";
import { algoliasearch as searchClient } from "algoliasearch";
import { convert_article_to_algolia_object } from "~/lib/algoliasearch";
import { cachedAllAuthors } from "~/server/cached-global-state";
import { convert_content_to_text } from "~/lib/content-to-text";

export async function test_strong_bold() {
  const articles = await db.query.PublishedArticle.findMany({
    orderBy: asc(PublishedArticle.id),
  });

  for (const article of articles) {
    if (article.id % 100 === 0) console.log(article.id);
    if (!article.content?.blocks) continue;

    let has_strong = false;
    for (const block of article.content.blocks) {
      if (block.type === "paragraph") {
        const paragraph_data = block.data as { text: string };
        const text = paragraph_data.text;
        const strong = text.match(/<strong>/g);

        if (strong && strong.length > 1) {
          has_strong = true;
          break;
        }
      }
    }
    if (has_strong) console.log(article.id, article.title, "has strong");
  }
  console.log("done");
}

export async function delete_s3_published_bucket() {
  console.log("deleting s3 published bucket");
  await delete_s3_directory(env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME, "");
  console.log("done");
}

export async function delete_articles() {
  console.log("deleting articles");
  await db.execute(
    sql`TRUNCATE TABLE ${PublishedArticle} RESTART IDENTITY CASCADE;`,
  );

  await db.execute(
    sql`TRUNCATE TABLE ${DraftArticle} RESTART IDENTITY CASCADE;`,
  );

  await delete_s3_directory(env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME, "");
  console.log("done");
}

export async function get_authors_server() {
  return db.query.Author.findMany();
}

export async function delete_authors() {
  console.log("deleting authors");
  await db.execute(sql`TRUNCATE TABLE ${Author} RESTART IDENTITY CASCADE;`);
  console.log("done");
}

export async function sync_authors() {
  // const google_authors = await api.author.sync_with_google();
  if (true as boolean) {
    throw new Error("Tega ne smeš več klicat");
  }
  const google_authors = await cachedAllAuthors();

  const read_file = true as boolean;
  if (!read_file) return;

  const not_found_authors = new Set<string>();
  const authors_by_name = await get_authors_by_name();

  for (const author_by_name of authors_by_name) {
    let author = author_by_name.name;

    if (typeof author_by_name.change === "boolean") {
      continue;
    } else if (typeof author_by_name.change === "string") {
      author = author_by_name.change;
    }

    author = author.trim();
    author.split(", ").forEach((split_author) => {
      const author_obj = google_authors.find((a) => a.name === split_author);

      if (!author_obj) {
        not_found_authors.add(split_author);
      }
    });
  }

  const guest_authors = Array.from(not_found_authors);
  const mapped_guest_authors = guest_authors.map(
    (guest) =>
      ({
        author_type: "guest",
        name: guest,
        google_id: null,
      }) satisfies typeof Author.$inferInsert,
  );

  await db.insert(Author).values(mapped_guest_authors).returning();
  console.log("Inserted guest authors", mapped_guest_authors.length);
  console.log("done");
  // fs_promises.readFile()
}

export async function get_image_dimensions({
  fs_name,
  old_path,
  image_name,
  do_dimensions,
}: {
  fs_name: string;
  old_path: string;
  image_name: string;
  do_dimensions: boolean;
}): Promise<DimensionType | undefined> {
  // console.log("Getting image dimensions", { fs_name, old_path, image_name });

  const fs_image_path = path.join(
    process.cwd(),
    "src/app/converter/_files",
    fs_name,
  );

  if (!do_dimensions) {
    return {
      width: 0,
      height: 0,
      fs_name: fs_name,
      old_path,
      image_name,
    };
  }

  if (!fs.existsSync(fs_image_path)) {
    console.error(`Image doesn't exist: ${fs_image_path}`);
    return;
  }

  const result = await fs_promises.readFile(fs_image_path);

  const sharp_result = sharp(result);
  const metadata = await sharp_result.metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error(`Image sharp error, no dimensions: ${fs_image_path}`);
  }

  return {
    width,
    height,
    fs_name: fs_name,
    old_path,
    image_name,
  } satisfies DimensionType;
}

export async function upload_articles(
  articles: ConverterArticleWithAuthorIds[],
) {
  if (articles.length === 0) return;
  await db.transaction(async (tx) => {
    /*console.log("Inserting articles", articles.length);
    if (articles.length == 0) {
      throw new Error("No articles to insert");
    }

    const returned_articles = await tx
      .insert(PublishedArticle)
      .values(articles)
      .returning();*/
    const returned_articles = await tx.query.PublishedArticle.findMany();

    const joins: (typeof PublishedArticlesToAuthors.$inferInsert)[] = [];
    for (const article of returned_articles) {
      const imported_article = articles.find(
        (a) => a.old_id === article.old_id,
      );
      if (!imported_article) {
        throw new Error(`Article not found: ${article.old_id}`);
      }

      let index = 0;
      for (const author_id of imported_article.author_ids) {
        joins.push({
          author_id: author_id,
          published_id: article.id,
          order: index,
        });
        index++;
      }
    }

    console.log("Inserting joins", joins.length);
    if (joins.length > 0)
      await tx.insert(PublishedArticlesToAuthors).values(joins);
  });

  console.log("done uploading articles");
}

export async function content_size_stats() {
  const articles = await db.query.PublishedArticle.findMany({
    with: {
      published_articles_to_authors: {
        with: { author: true },
        orderBy: asc(PublishedArticlesToAuthors.order),
      },
    },
  });

  const texts = articles.map((a) => convert_content_to_text(a.content?.blocks));
  const maxLength = texts.reduce((max, text) => Math.max(max, text.length), 0);
  console.log("max length is", maxLength);
  const totalLength = texts.reduce((sum, text) => sum + text.length, 0);
  const averageLength = totalLength / texts.length;
  console.log("avg length is", averageLength);
}

// sync just the published articles
export async function sync_with_algolia() {
  console.log("Syncing articles");

  /* const articles = await db.query.PublishedArticle.findMany({
    // limit: 10,
  }); */
  const articles = await db.query.PublishedArticle.findMany({
    with: {
      published_articles_to_authors: {
        with: { author: true },
        orderBy: asc(PublishedArticlesToAuthors.order),
      },
    },
  });

  const indexName = "published_article";
  const client = searchClient(
    env.NEXT_PUBLIC_ALGOLIA_ID,
    env.ALGOLIA_ADMIN_KEY,
  );
  const all_record_ids: string[] = [];
  await client.browseObjects({
    indexName,
    aggregator: (response) => {
      all_record_ids.push(...response.hits.map((hit) => hit.objectID));
    },
  });

  await client.deleteObjects({
    indexName,
    objectIDs: all_record_ids,
  });

  const chunkSize = 20;
  const objects = articles
    .map(convert_article_to_algolia_object)
    .filter((article) => typeof article !== "undefined");

  for (let i = 0; i < objects.length; i += chunkSize) {
    const chunk = objects.slice(i, i + chunkSize);
    console.log("Saving chunk", i, chunk.length);
    await client.saveObjects({
      indexName,
      objects: chunk,
    });
  }

  console.log("Done", objects.length);
}

/* export async function write_article_html_to_file(
  problematic_articles: ProblematicArticleType[],
) {
  const some_time = Date.now();
  const dir = `./pt-novicke/${some_time}`;
  await fs_promises.mkdir(dir, { recursive: true });

  const promises = problematic_articles.map(async ({ html, csv }) => {
    return fs_promises.writeFile(`${dir}/${csv.id}.html`, html);
  });

  await Promise.all(promises);
} */

export async function get_problematic_html(
  id: number,
  problematic_dir: string,
) {
  const problematic_html = path.join(
    process.cwd(),
    "src/app/converter/_htmls",
    problematic_dir,
    `${id}.html`,
  );
  return fs_promises.readFile(problematic_html, "utf-8");
}

export async function save_file_data(images: FilesToSave[]) {
  const images_dir = path.join(process.cwd(), "src/app/converter/_image-data");
  if (fs.existsSync(images_dir)) {
    fs.rmSync(images_dir, { recursive: true });
  }

  await fs_promises.mkdir(images_dir, { recursive: true });

  const promises = images.map(async (image) => {
    const image_path = path.join(images_dir, `${image.objave_id}.json`);

    return fs_promises.writeFile(image_path, JSON.stringify(image));
  });

  await Promise.all(promises);
}

export async function copy_and_rename_images() {
  console.log("Copying images");
  const original_images_dir = path.join(
    process.cwd(),
    "src/app/converter/_image-data",
  );
  const converted_images_dir = path.join(
    process.cwd(),
    "src/app/converter/_files",
  );

  if (fs.existsSync(converted_images_dir)) {
    fs.rmSync(converted_images_dir, { recursive: true });
  }

  const image_promises: Promise<PromiseSettledResult<void>[]>[] = [];
  await fs_promises.mkdir(original_images_dir, { recursive: true });
  await fs_promises.mkdir(converted_images_dir, { recursive: true });

  const files = await fs_promises.readdir(original_images_dir);

  for (const file of files) {
    const original_image_path = path.join(original_images_dir, file);

    if (!fs.existsSync(original_image_path)) {
      console.error("JSON file for image doesn't exist", original_image_path);
      break;
    }

    const directory_promise = new Promise<PromiseSettledResult<void>[]>(
      (resolve) => {
        const file = fs.readFileSync(original_image_path, "utf-8");
        const json = JSON.parse(file) as FilesToSave;

        const image_promises = json.images.map(async (image) => {
          // console.log("Copying image", image, json);
          const old_path = path.join(JKNM_SERVED_DIR, image.old_path);

          const new_dir = path.join(
            converted_images_dir,
            path.dirname(image.fs_name),
          );

          await fs_promises.mkdir(new_dir, { recursive: true });

          if (!fs.existsSync(new_dir)) {
            throw new Error(`New dir doesn't exist: ${new_dir}`);
          }

          const new_path = path.join(converted_images_dir, image.fs_name);
          // console.log("Copying", { old_path, fs_name });
          await fs_promises.copyFile(old_path, new_path);
        });

        const file_promises = json.files.map(async (file) => {
          const old_path = path.join(JKNM_SERVED_DIR, file.old_path);

          const new_dir = path.join(
            converted_images_dir,
            path.dirname(file.fs_name),
          );

          await fs_promises.mkdir(new_dir, { recursive: true });

          if (!fs.existsSync(new_dir)) {
            throw new Error(`New dir doesn't exist: ${new_dir}`);
          }

          const new_path = path.join(converted_images_dir, file.fs_name);

          // console.log("Copying file", { old_path, new_path });
          await fs_promises.copyFile(old_path, new_path);
          // console.log("Copied file", { old_path, new_path });
        });

        const all_image_promises = Promise.allSettled(image_promises);
        const all_file_promises = Promise.allSettled(file_promises);

        all_image_promises
          .then(async (image_results) => {
            // thumbnail
            const first_image = json.images[0];
            if (first_image && json.thumbnail_crop) {
              const old_path = path.join(JKNM_SERVED_DIR, first_image.old_path);

              const new_dir = path.join(
                converted_images_dir,
                path.dirname(first_image.fs_name),
              );

              if (!fs.existsSync(new_dir)) {
                console.log("to", fs.readdirSync(converted_images_dir));
                throw new Error(`New dir doesn't exist: ${new_dir}`);
              }

              const new_path = path.join(
                converted_images_dir,
                path.dirname(first_image.fs_name),
                "thumbnail.png",
              );

              const thumb_buffer = fs.readFileSync(old_path);
              const thumb_file = new File([thumb_buffer], "thumbnail.png", {
                type: "image/png",
              });

              const cropped_file = await crop_image(
                thumb_file,
                json.thumbnail_crop,
              );
              const cropped_buffer = await cropped_file.arrayBuffer();
              fs.writeFileSync(new_path, Buffer.from(cropped_buffer));
            }

            const file_results = await all_file_promises;

            resolve([...image_results, ...file_results]);
          })
          .catch((error) => {
            // Handle any potential errors (although Promise.allSettled resolves everything)
            console.error("Error when copying images:", error);
          });
      },
    );

    image_promises.push(directory_promise);
  }

  console.log("Starting promises");
  const results = await Promise.allSettled(image_promises);

  for (const dir_result of results) {
    if (dir_result.status === "rejected") {
      console.error("Rejected promise", dir_result.reason);
    } else {
      for (const file_result of dir_result.value) {
        if (file_result.status === "rejected") {
          console.error("Rejected file promise", file_result.reason);
        }
      }
    }
  }

  console.log("Done");
}

const JKNM_SERVED_DIR = "D:/JKNM/served";

export async function get_authors_by_name() {
  const authors_by_name_path = path.join(
    process.cwd(),
    "src/app/converter/info/authors_by_name.json",
  );

  const authors_by_name = await fs_promises.readFile(
    authors_by_name_path,
    "utf-8",
  );
  // TODO
  return JSON.parse(authors_by_name) as AuthorType[];
}
