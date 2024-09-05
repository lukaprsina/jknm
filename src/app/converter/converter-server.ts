"use server";
import path from "node:path";
import fs from "node:fs";
import fs_promises from "node:fs/promises";
import { finished } from "node:stream/promises";
import type { OutputData } from "@editorjs/editorjs";
import { parse as csv_parse } from "csv-parse";
import { count, eq, sql } from "drizzle-orm";
import sharp from "sharp";

import type { ImageToSave } from "./converter-spaghetti";
import type { AuthorType } from "./get-authors";
import { content_to_text } from "~/lib/content-to-text";
import { db } from "~/server/db";
import {
  Author,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";
import { algolia_protected } from "~/lib/algolia-server";
import type { ArticleHit } from "~/lib/validators";
import { api } from "~/trpc/server";

export interface CSVType {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
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

  if (!google_authors) {
    throw new Error("No google authors");
  }

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
  try {
    console.log("Fetching image", src);
    const result = await fetch(src);
    if (!result.ok) {
      console.error("Image fetch error", src, result.status);
      return;
    }

    const buffer = await result.arrayBuffer(); // Convert the Response object to a Buffer
    const sharp_result = sharp(buffer);
    const metadata = await sharp_result.metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (e: unknown) {
    console.error("Sharp error", e);
    return;
  }
}

export interface TempArticleType {
  serial_id: number;
  objave_id: string;
  title: string;
  preview_image: string | undefined;
  content: OutputData;
  csv_url: string;
  created_at: Date;
  updated_at: Date;
  author_ids: number[];
}

function convert_article(
  article: TempArticleType,
): typeof PublishedArticle.$inferInsert {
  return {
    id: article.serial_id,
    old_id: parseInt(article.objave_id),
    title: article.title,
    content: article.content,
    created_at: article.created_at,
    updated_at: article.updated_at,
    preview_image: article.preview_image,
    url: article.csv_url,
  };
}

export async function upload_articles(
  articles: TempArticleType[],
  do_update: boolean,
) {
  if (articles.length === 0) return;
  await db.transaction(async (tx) => {
    if (do_update) {
      console.log("Updating articles", articles);
      for (const article of articles) {
        await tx
          .update(PublishedArticle)
          .set(convert_article(article))
          .where(eq(PublishedArticle.id, article.serial_id));
      }
    } else {
      console.log("Inserting articles", articles);
      if (articles.length > 0)
        await tx.insert(PublishedArticle).values(articles.map(convert_article));
    }

    const joins: (typeof PublishedArticlesToAuthors.$inferInsert)[] = [];
    for (const article of articles) {
      for (const author_id of article.author_ids) {
        joins.push({
          author_id: author_id,
          article_id: article.serial_id,
        });
      }
    }

    console.log("Inserting joins", joins);
    if (joins.length > 0)
      await tx.insert(PublishedArticlesToAuthors).values(joins);
  });

  console.log("done uploading articles");
}

export async function read_articles() {
  const csv_articles: CSVType[] = [];

  const objave_path = path.join(process.cwd(), "src/assets/Objave.txt");

  await finished(
    fs
      .createReadStream(objave_path)
      .pipe(csv_parse({ delimiter: "," }))
      .on("data", function (csvrow: string[]) {
        if (typeof csvrow[2] == "undefined" || parseInt(csvrow[2]) !== 1)
          return;
        if (!csvrow[0] || !csvrow[4] || !csvrow[6] || !csvrow[8] || !csvrow[15])
          throw new Error("Missing data: " + JSON.stringify(csvrow, null, 2));

        csv_articles.push({
          id: csvrow[0],
          title: csvrow[4],
          content: csvrow[6],
          created_at: csvrow[8],
          updated_at: csvrow[15],
        });
      }),
  );

  return csv_articles;
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
      const content_preview = content_to_text(article.content ?? undefined);
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
  id: string,
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

export async function save_images(images: ImageToSave[]) {
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

  const promises: Promise<void>[] = [];
  await fs_promises.mkdir(original_images_dir, { recursive: true });
  await fs_promises.mkdir(converted_images_dir, { recursive: true });

  // 625
  for (let objave_id = 1; objave_id <= 630; objave_id++) {
    const original_image_path = path.join(
      original_images_dir,
      `${objave_id}.json`,
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
        return fs_promises.copyFile(old_path, new_path);
      });

      await Promise.all(nested_promises);
    };

    promises.push(callback());
  }

  await Promise.all(promises);
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
