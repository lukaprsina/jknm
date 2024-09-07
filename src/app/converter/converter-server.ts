"use server";

import path from "node:path";
import fs from "node:fs";
import fs_promises from "node:fs/promises";
import type { OutputData } from "@editorjs/editorjs";
import { count, sql } from "drizzle-orm";
import sharp from "sharp";

import type {
  ImageToSave,
  PublishedArticleWithAuthors,
} from "./converter-spaghetti";
import type { AuthorType } from "./get-authors";
import { content_to_text as convert_content_to_text } from "~/lib/content-to-text";
import { db } from "~/server/db";
import {
  Author,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";
import { algolia_protected } from "~/lib/algolia-server";
import type { ArticleHit } from "~/lib/validators";
import { api } from "~/trpc/server";

export async function get_authors_server() {
  const authors = await db.query.Author.findMany();
  return authors;
}

export async function delete_articles() {
  console.log("deleting articles");
  await db.execute(
    sql`TRUNCATE TABLE ${PublishedArticle} RESTART IDENTITY CASCADE;`,
  );
  console.log("done");
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

export async function get_image_dimensions(src: string) {
  const src_parts = src.split("/");
  const dir = src_parts.at(-2);
  const name = src_parts.at(-1);
  if (!dir || !name) {
    throw new Error(`Image sharp error: ${src}`);
  }

  const image_path = path.join(
    process.cwd(),
    "src/app/converter/_images",
    dir,
    name,
  );

  if (!fs.existsSync(image_path)) {
    throw new Error(`Image doesn't exist: ${image_path}`);
  }
  const result = await fs_promises.readFile(image_path);

  const sharp_result = sharp(result);
  const metadata = await sharp_result.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) return;
  return { width, height, image_path };
}

export interface TempArticleType {
  serial_id: number;
  objave_id: number;
  title: string;
  preview_image: string | undefined;
  content: OutputData;
  csv_url: string;
  created_at: Date;
  updated_at: Date;
  author_ids: number[];
}

export async function upload_articles(articles: PublishedArticleWithAuthors[]) {
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
          article_id: article.id,
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

  const algolia = algolia_protected.getClient();
  const index = algolia.initIndex("novice");

  const empty_query_results = await index.search("", {
    attributesToRetrieve: ["objectID"],
    hitsPerPage: 1000,
  });

  index.deleteObjects(empty_query_results.hits.map((hit) => hit.objectID));

  const objects: ArticleHit[] = articles.data
    .map((article) => {
      const content_preview = convert_content_to_text(article.content?.blocks);
      if (!content_preview) return;

      return {
        objectID: article.id.toString(),
        title: article.title,
        url: article.url,
        created_at: article.created_at.getTime(),
        image: article.preview_image ?? undefined,
        content_preview,
        is_draft: false,
        year: article.created_at.getFullYear().toString(),
        author_ids: article.published_articles_to_authors.map(
          (a) => a.author_id,
        ),
      } satisfies ArticleHit;
    })
    .filter((article) => typeof article !== "undefined");

  await index.saveObjects(objects);

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

export async function get_article_count() {
  const article_count = await db
    .select({ count: count() })
    .from(PublishedArticle);
  return article_count.at(0)?.count;
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

  const promises: Promise<PromiseSettledResult<string>[]>[] = [];
  await fs_promises.mkdir(original_images_dir, { recursive: true });
  await fs_promises.mkdir(converted_images_dir, { recursive: true });

  const files = await fs_promises.readdir(original_images_dir);

  // 625
  // for (let objave_id = 1; objave_id <= 630; objave_id++) {
  for (const file of files) {
    const original_image_path = path.join(
      original_images_dir,
      file,
      // `${objave_id}.json`,
    );

    if (!fs.existsSync(original_image_path)) {
      console.error("JSON file for image doesn't exist", original_image_path);
      break;
    }

    const callback = async () => {
      const file = await fs_promises.readFile(original_image_path, "utf-8");
      const json = JSON.parse(file) as ImageToSave;

      const nested_promises = json.images.map(async (image) => {
        const old_path = path.join(JKNM_SERVED_DIR, image);
        const image_name = path.basename(old_path);

        const new_dir = path.join(converted_images_dir, json.url);
        await fs_promises.mkdir(new_dir, { recursive: true });

        if (!fs.existsSync(new_dir)) {
          throw new Error(`New dir doesn't exist: ${new_dir}`);
        }

        const new_path = path.join(new_dir, image_name);
        // console.log("Copying", old_path, new_path);
        await fs_promises.copyFile(old_path, new_path);
        return new_path;
      });

      return await Promise.allSettled(nested_promises);
    };

    promises.push(callback());
  }

  console.log("Starting promises");
  const results = await Promise.allSettled(promises);
  const rejectedPromises = results
    .flatMap((result) => {
      if (result.status === "rejected") {
        return result;
      }
    })
    .filter(
      (result): result is PromiseRejectedResult =>
        typeof result !== "undefined",
    );
  console.log("Rejected promises:", rejectedPromises);

  console.log("Done");
}

const JKNM_SERVED_DIR = "D:/JKNM/served";

export async function get_authors_by_name() {
  const authors_by_name_path = path.join(
    process.cwd(),
    "src/app/converter/_info/authors_by_name.json",
  );

  const authors_by_name = await fs_promises.readFile(
    authors_by_name_path,
    "utf-8",
  );
  // TODO
  const authors = JSON.parse(authors_by_name) as AuthorType[];
  return authors;
}
