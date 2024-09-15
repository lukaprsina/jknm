"use server";

import path from "path";
import fs from "node:fs";
import fs_promises from "node:fs/promises";
import { sql } from "drizzle-orm";
import sharp from "sharp";

import type {
  ConverterArticleWithAuthorIds,
  DimensionType,
  ImageToSave,
} from "./converter-spaghetti";
import type { AuthorType } from "./get-authors";
import { content_to_text } from "~/lib/content-to-text";
import { db } from "~/server/db";
import {
  Author,
  DraftArticle,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";
import type { PublishedArticleHit } from "~/lib/validators";
import { api } from "~/trpc/server";
import { crop_image, delete_s3_directory } from "~/server/s3-utils";
import { env } from "~/env";

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
  const google_authors = await api.author.sync_with_google();

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
  // fs_promises.readFile()
}

export async function get_image_dimensions({
  s3_url,
  old_path,
  image_name,
  do_dimensions,
}: {
  s3_url: string;
  old_path: string;
  image_name: string;
  do_dimensions: boolean;
}): Promise<DimensionType | undefined> {
  // console.log("Getting image dimensions", { s3_url, old_path, image_name });

  const fs_image_path = path.join(
    process.cwd(),
    "src/app/converter/_images",
    s3_url,
  );

  if (!do_dimensions) {
    return {
      width: 0,
      height: 0,
      s3_url,
      old_path,
      image_name,
    };
  }

  if (!fs.existsSync(fs_image_path)) {
    console.error(`Image doesn't exist: ${fs_image_path}`);
    return
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
    s3_url,
    old_path,
    image_name,
  } satisfies DimensionType;
}

export async function upload_articles(
  articles: ConverterArticleWithAuthorIds[],
) {
  if (articles.length === 0) return;
  await db.transaction(async (tx) => {
    console.log("Inserting articles", articles.length);
    if (articles.length == 0) {
      throw new Error("No articles to insert");
    }

    const returned_articles = await tx
      .insert(PublishedArticle)
      .values(articles)
      .returning();

    const joins: (typeof PublishedArticlesToAuthors.$inferInsert)[] = [];
    for (const article of returned_articles) {
      const imported_article = articles.find(
        (a) => a.old_id === article.old_id,
      );
      if (!imported_article) {
        throw new Error(`Article not found: ${article.old_id}`);
      }

      for (const author_id of imported_article.author_ids) {
        joins.push({
          author_id: author_id,
          published_id: article.id,
        });
      }
    }

    console.log("Inserting joins", joins.length);
    if (joins.length > 0)
      await tx.insert(PublishedArticlesToAuthors).values(joins);
  });

  console.log("done uploading articles");
}

// sync just the published articles
export async function sync_with_algolia() {
  console.log("Syncing articles");

  /* const articles = await db.query.PublishedArticle.findMany({
    // limit: 10,
  }); */
  const articles = await api.article.get_infinite_published({
    limit: 1000,
  });

  /* const algolia = algolia_protected.getClient();
  const index = algolia.initIndex("novice");

  const empty_query_results = await index.search("", {
    attributesToRetrieve: ["objectID"],
    hitsPerPage: 1000,
  });

  index.deleteObjects(empty_query_results.hits.map((hit) => hit.objectID)); */

  const objects: PublishedArticleHit[] = articles.data
    .map((article) => {
      const content_preview = content_to_text(article.content?.blocks);
      if (!content_preview) return;

      return {
        published_id: article.id,
        title: article.title,
        url: article.url,
        created_at: article.created_at.getTime(),
        content_preview,
        year: article.created_at.getFullYear().toString(),
        author_ids: article.published_articles_to_authors.map(
          (a) => a.author_id,
        ),
        has_thumbnail: Boolean(article.thumbnail_crop),
      } satisfies PublishedArticleHit;
    })
    .filter((article) => typeof article !== "undefined");

  // await index.saveObjects(objects);

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

export async function save_image_data(images: ImageToSave[]) {
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
    "src/app/converter/_images",
  );

  if (fs.existsSync(converted_images_dir)) {
    fs.rmSync(converted_images_dir, { recursive: true });
  }

  const image_promises: Promise<PromiseSettledResult<void>[]>[] = [];
  const thumbnail_promises: Promise<void>[] = [];
  await fs_promises.mkdir(original_images_dir, { recursive: true });
  await fs_promises.mkdir(converted_images_dir, { recursive: true });

  const files = await fs_promises.readdir(original_images_dir);

  for (const file of files) {
    const original_image_path = path.join(original_images_dir, file);

    if (!fs.existsSync(original_image_path)) {
      console.error("JSON file for image doesn't exist", original_image_path);
      break;
    }

    const promise = new Promise<PromiseSettledResult<void>[]>((resolve) => {
      const file = fs.readFileSync(original_image_path, "utf-8");
      const json = JSON.parse(file) as ImageToSave;

      const nested_promises = json.images.map(async (image) => {
        // console.log("Copying image", image, json);
        const old_path = path.join(JKNM_SERVED_DIR, image.old_path);

        const new_dir = path.join(
          converted_images_dir,
          path.dirname(image.s3_url),
        );

        await fs_promises.mkdir(new_dir, { recursive: true });

        if (!fs.existsSync(new_dir)) {
          throw new Error(`New dir doesn't exist: ${new_dir}`);
        }

        const new_path = path.join(converted_images_dir, image.s3_url);
        // console.log("Copying", { old_path, new_path });
        await fs_promises.copyFile(old_path, new_path);
      });

      const all_image_promises = Promise.allSettled(nested_promises);

      all_image_promises
        .then((imageResults) => {
          // Wait for all thumbnail promises after image promises have settled

          // thumbnail
          const first_image = json.images[0];
          if (first_image && json.thumbnail_crop) {
            const old_path = path.join(JKNM_SERVED_DIR, first_image.old_path);

            const new_dir = path.join(
              converted_images_dir,
              path.dirname(first_image.s3_url),
            );

            if (!fs.existsSync(new_dir)) {
              console.log("to", fs.readdirSync(converted_images_dir));
              throw new Error(`New dir doesn't exist: ${new_dir}`);
            }

            const new_path = path.join(
              converted_images_dir,
              path.dirname(first_image.s3_url),
              "thumbnail.png",
            );

            const thumb_buffer = fs.readFileSync(old_path);
            const thumb_file = new File([thumb_buffer], "thumbnail.png", {
              type: "image/png",
            });

            const promise = crop_image(thumb_file, json.thumbnail_crop).then(
              async (file) => {
                const buffer = await file.arrayBuffer();
                return fs.writeFileSync(new_path, Buffer.from(buffer));
              },
            );
            thumbnail_promises.push(promise);
          }
          resolve(imageResults);
          return imageResults;
        })
        .catch((error) => {
          // Handle any potential errors (although Promise.allSettled resolves everything)
          console.error("Error when copying images:", error);
        });
    });

    image_promises.push(promise);
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
