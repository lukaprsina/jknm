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
} from "./converter-server";
import { get_authors } from "./get-authors";
import { parse_node } from "./parse-node";
import type { RouterOutputs } from "~/trpc/react";
import { get_image_data_from_editor } from "~/lib/editor-utils";
import { read_from_xml } from "./xml-server";
import type { PublishedArticle } from "~/server/db/schema";
import { PROBLEMATIC_CONSTANTS } from "./_info/problematic";
import { convert_title_to_url } from "~/lib/article-utils";

export interface ImageToSave {
  objave_id: number;
  serial_id: string;
  url: string;
  images: string[];
}

export interface ImportedArticle {
  objave_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DimensionType {
  dimensions: { width: number; height: number };
  ids: number[];
}

type PublishedArticleInsert = typeof PublishedArticle.$inferInsert;
export interface PublishedArticleWithAuthors extends PublishedArticleInsert {
  author_ids: number[];
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
const ids_by_dimensions: DimensionType[] = [];

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

  const articles: PublishedArticleWithAuthors[] = [];
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
): Promise<PublishedArticleWithAuthors> {
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

  const csv_url = convert_title_to_url(imported_article.title);

  const blocks: OutputBlockData[] = [
    {
      type: "header",
      data: { text: imported_article.title, level: 1 },
    },
  ];

  const image_urls: string[] = [];

  for (const image of root.querySelectorAll("img")) {
    const src = image.getAttribute("src");
    if (!src) throw new Error("No src attribute in image");

    image_urls.push(decodeURIComponent(src));
  }

  images_to_save.push({
    objave_id: imported_article.objave_id,
    serial_id: article_id.toString(),
    url: csv_url,
    images: image_urls,
  });

  for (const node of root.childNodes) {
    if (node.nodeType == NodeType.ELEMENT_NODE) {
      await parse_node(
        node,
        blocks,
        imported_article,
        csv_url,
        problems,
        ids_by_dimensions,
      );
    } else if (node.nodeType == NodeType.TEXT_NODE) {
      if (node.text.trim() !== "") throw new Error("Some text: " + node.text);
    } else {
      throw new Error("Unexpected comment: " + node.text);
    }
  }

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

  const images = get_image_data_from_editor(content);
  const preview_image = images.length !== 0 ? images[0]?.file.url : undefined;

  if (typeof preview_image === "undefined") {
    console.error(
      "No images in article",
      imported_article.objave_id,
      imported_article.title,
    );
  }

  const article: PublishedArticleWithAuthors = {
    // serial_id: article_id,
    old_id: imported_article.objave_id,
    title: imported_article.title,
    preview_image,
    content,
    url: csv_url,
    created_at,
    updated_at,
    author_ids: Array.from(current_authors),
  };

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
