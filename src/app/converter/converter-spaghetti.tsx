"use client";

import type EditorJS from "@editorjs/editorjs";
import type { OutputBlockData } from "@editorjs/editorjs";
import dom_serialize from "dom-serializer";
import { parseDocument } from "htmlparser2";
import { parse as html_parse, NodeType } from "node-html-parser";

import type { AuthorType } from "./get-authors";
import {
  get_authors_by_name,
  get_problematic_html,
  save_image_data,
  upload_articles,
} from "./converter-server-wtf";
import { get_authors } from "./get-authors";
import { parse_node } from "./parse-node";
import type { RouterOutputs } from "~/trpc/react";
import { read_from_xml } from "./xml-server";
import { PROBLEMATIC_CONSTANTS } from "./info/problematic";
import { convert_title_to_url } from "~/lib/article-utils";
import type { PublishArticleSchema } from "~/server/db/schema";
import type { z } from "zod";
import type { ThumbnailType } from "~/lib/validators";

export type ConverterArticleWithAuthorIds = z.infer<
  typeof PublishArticleSchema
> & {
  author_ids: number[];
};

export interface ImageToSave {
  objave_id: number;
  serial_id: string;
  url: string;
  images: DimensionType[];
  created_at: Date;
}

export interface ImportedArticle {
  objave_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DimensionType {
  width: number;
  height: number;
  s3_url: string;
  image_name: string;
  old_path: string;
}

export interface ImageInfo {
  thumbnail_crop: ThumbnailType | undefined;
  images: DimensionType[];
}

export interface IdsByDimentionType {
  dimensions: { width: number; height: number };
  ids: number[];
}

export type InitialProblems = Record<ProblemKey, [number, string][]>;

const initial_problems: InitialProblems = {
  single_in_div: [],
  problematic_articles: [],
  image_in_caption: [],
  videos: [],
  videos_no_id: [],
  empty_captions: [],
};

export type ProblemKey =
  | "single_in_div"
  | "problematic_articles"
  | "image_in_caption"
  | "videos"
  | "videos_no_id"
  | "empty_captions";

const images_to_save: ImageToSave[] = [];
const articles_without_authors = new Set<number>();
const authors_by_id: { id: string; names: string[] }[] = [];
let authors_by_name: AuthorType[] = [];
const ids_by_dimensions: IdsByDimentionType[] = [];

export async function iterate_over_articles(
  editorJS: EditorJS | null,
  do_splice: boolean,
  do_dry_run: boolean,
  _do_update: boolean,
  first_article: number,
  last_article: number,
  all_authors: RouterOutputs["author"]["get_all"],
) {
  const problems = initial_problems;

  images_to_save.length = 0;
  articles_without_authors.clear();
  authors_by_id.length = 0;
  authors_by_name.length = 0;
  ids_by_dimensions.length = 0;

  /* const spliced_csv_articles = do_splice
    ? csv_articles.slice(first_article, last_article)
    : csv_articles; */
  const imported_articles = await read_from_xml();
  const first_index = imported_articles.findIndex(
    (a) => a.objave_id === first_article,
  );
  const last_index =
    last_article === -1
      ? undefined
      : imported_articles.findIndex((a) => a.objave_id === last_article);

  /* if (first_index === -1) first_index = 0;
  if (last_index === -1) last_index = csv_articles.length - 1; */
  if (first_index === -1 || last_index === -1) {
    const first = imported_articles[0];

    console.log("spliced_csv_articles", {
      first_index,
      last_index,
      first_article,
      last_article,
      do_splice,
      first,
      csv_articles: imported_articles,
    });

    console.error("Invalid index", imported_articles);
    return;
  }

  const sliced_csv_articles = do_splice
    ? imported_articles.slice(first_index, last_index)
    : imported_articles;

  const articles: ConverterArticleWithAuthorIds[] = [];
  let article_id = do_splice && first_index !== -1 ? first_index + 1 : 1;

  authors_by_name = await get_authors_by_name();

  for (const csv_article of sliced_csv_articles) {
    const article = await parse_csv_article(
      csv_article,
      editorJS,
      article_id,
      all_authors,
      authors_by_name,
      problems,
    );
    articles.push(article);
    article_id++;
  }

  console.log("done", articles);
  if (!do_dry_run) {
    await upload_articles(articles);
  }

  // console.warn("Images to save", images_to_save);
  await save_image_data(images_to_save);
  // await write_article_html_to_file(problematic_articles);
  console.log(
    "Total articles (csv, uploaded):",
    imported_articles.length,
    articles.length,
  );
  console.log("Problems:", problems);
  console.log("Dimensions:", ids_by_dimensions);

  console.log(
    "Authors (articles without authors, by name, by id):",
    Array.from(articles_without_authors),
    authors_by_name.sort((a, b) => a.name.localeCompare(b.name)),
    authors_by_id,
  );
}

async function parse_csv_article(
  imported_article: ImportedArticle,
  editorJS: EditorJS | null,
  article_id: number,
  all_authors: RouterOutputs["author"]["get_all"],
  authors_by_name: AuthorType[],
  problems: InitialProblems,
): Promise<ConverterArticleWithAuthorIds> {
  const problematic_dir = "1723901265154";

  let html = imported_article.content;
  if (PROBLEMATIC_CONSTANTS.includes(imported_article.objave_id)) {
    console.log("Getting article", imported_article.objave_id, "from file");
    html = await get_problematic_html(
      imported_article.objave_id,
      problematic_dir,
    );
  }

  html = fixHtml(html);
  const root = html_parse(html);

  const created_at = new Date(imported_article.created_at);
  const updated_at = new Date(imported_article.updated_at);

  const converted_url = convert_title_to_url(imported_article.title);

  const blocks: OutputBlockData[] = [
    {
      type: "header",
      data: { text: imported_article.title, level: 1 },
    },
  ];

  const image_info: ImageInfo = {
    thumbnail_crop: undefined,
    images: [],
  };

  for (const node of root.childNodes) {
    if (node.nodeType == NodeType.ELEMENT_NODE) {
      await parse_node(
        node,
        blocks,
        created_at,
        imported_article,
        converted_url,
        problems,
        ids_by_dimensions,
        image_info,
      );
    } else if (node.nodeType == NodeType.TEXT_NODE) {
      if (node.text.trim() !== "") throw new Error("Some text: " + node.text);
    } else {
      throw new Error("Unexpected comment: " + node.text);
    }
  }

  console.log("image_info", image_info);
  images_to_save.push({
    objave_id: imported_article.objave_id,
    serial_id: article_id.toString(),
    url: converted_url,
    images: image_info.images,
    created_at,
  });

  // const new_authors = new Set<string>();
  // const not_found_authors = new Set<string>();
  const current_authors = get_authors(
    imported_article,
    blocks,
    authors_by_name,
    all_authors,
  );

  await editorJS?.render({
    blocks,
  });

  const content = await editorJS?.save();
  if (!content) throw new Error("No content");

  /* const first_image = article_image_dimensions.images[0];
  if (first_image) {
    const width = first_image.width;
    const height = first_image.width;

    const converted_images_dir = path.join(
      process.cwd(),
      "src/app/converter/_images",
    );

    const article_dir = path.join(
      converted_images_dir,
      path.dirname(first_image.s3_url),
    );

    const image_article_path = path.join(
      converted_images_dir,
      path.dirname(first_image.s3_url),
    );

    const image_source = get_s3_prefix(
      first_image.s3_url,
      env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
    );
  } */

  const article = {
    old_id: imported_article.objave_id,
    title: imported_article.title,
    content,
    url: converted_url,
    created_at,
    updated_at,
    author_ids: Array.from(current_authors),
    thumbnail_crop: image_info.thumbnail_crop,
  } satisfies ConverterArticleWithAuthorIds;

  return article;
}

function fixHtml(htmlString: string) {
  const document = parseDocument(htmlString, {
    decodeEntities: true,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
  });

  const fixedHtml = dom_serialize(document);

  return fixedHtml;
}
