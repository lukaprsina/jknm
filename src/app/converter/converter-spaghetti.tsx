"use client";

import type EditorJS from "@editorjs/editorjs";
import type { OutputBlockData } from "@editorjs/editorjs";
import { parse as parseDate } from "date-format-parse";
import dom_serialize from "dom-serializer";
import { parseDocument } from "htmlparser2";
import { parse as html_parse, NodeType } from "node-html-parser";

import type { RouterOutputs } from "@acme/api";

import type { CSVType, TempArticleType } from "./converter-server";
import type { AuthorType } from "./get-authors";
import {
  get_clean_url,
  get_image_data_from_editor,
} from "../uredi/[novica_ime]/editor-utils";
import {
  get_authors_by_name,
  get_problematic_html,
  upload_articles,
} from "./converter-server";
import { get_authors } from "./get-authors";
import { parse_node } from "./parse-node";

export interface ImageToSave {
  objave_id: string;
  serial_id: string;
  url: string;
  images: string[];
}

const initial_problems: Record<string, [string, string][]> = {
  single_in_div: [],
  problematic_articles: [],
  image_in_caption: [],
  videos: [],
  empty_captions: [],
};

const images_to_save: ImageToSave[] = [];
const articles_without_authors = new Set<number>();
const authors_by_id: { id: string; names: string[] }[] = [];
let authors_by_name: AuthorType[] = [];

export async function iterate_over_articles(
  csv_articles: CSVType[],
  editorJS: EditorJS | null,
  do_splice: boolean,
  do_dry_run: boolean,
  do_update: boolean,
  first_article: number,
  last_article: number,
  all_authors: RouterOutputs["article"]["google_users"],
) {
  const problems = initial_problems;

  images_to_save.length = 0;
  articles_without_authors.clear();
  authors_by_id.length = 0;
  authors_by_name.length = 0;

  /* const spliced_csv_articles = do_splice
    ? csv_articles.slice(first_article, last_article)
    : csv_articles; */
  const first_index = csv_articles.findIndex(
    (a) => a.id === first_article.toString(),
  );
  const last_index =
    last_article === -1
      ? undefined
      : csv_articles.findIndex((a) => a.id === last_article.toString());

  /* if (first_index === -1) first_index = 0;
  if (last_index === -1) last_index = csv_articles.length - 1; */
  if (first_index === -1 || last_index === -1) {
    console.error("Invalid index", csv_articles.length);
    return;
  }

  const sliced_csv_articles = do_splice
    ? csv_articles.slice(first_index, last_index)
    : csv_articles;

  console.log("spliced_csv_articles", {
    first_index,
    last_index,
    first_article,
    last_article,
    do_splice,
    csv_articles,
  });

  console.log(
    csv_articles[first_index]?.title,
    csv_articles.at(last_index ?? -1)?.title,
    csv_articles.length - 1,
  );

  const articles: TempArticleType[] = [];
  let article_id = do_splice && first_index !== -1 ? first_index + 1 : 1;
  authors_by_name = await get_authors_by_name();

  if (!all_authors) {
    throw new Error("No authors");
  }

  for (const csv_article of sliced_csv_articles) {
    const article = await parse_csv_article(
      csv_article,
      editorJS,
      article_id,
      all_authors,
      problems,
      authors_by_name,
    );
    articles.push(article);
    article_id++;
  }

  console.log("done", articles);
  if (!do_dry_run) {
    await upload_articles(articles, do_update);
  }

  // await save_images(images_to_save);
  // await write_article_html_to_file(problematic_articles);
  console.log(
    "Total articles (csv, uploaded):",
    csv_articles.length,
    articles.length,
  );
  console.log("Problems:", problems);

  console.log(
    "Authors (articles without authors, by name, by id):",
    Array.from(articles_without_authors),
    authors_by_name.sort((a, b) => a.name.localeCompare(b.name)),
    authors_by_id,
  );
}

async function parse_csv_article(
  csv_article: CSVType,
  editorJS: EditorJS | null,
  article_id: number,
  all_authors: RouterOutputs["article"]["google_users"],
  problems: Record<string, [string, string][]>,
  authors_by_name: AuthorType[],
) {
  const problematic_dir = "1723901265154";

  let html = csv_article.content;
  if (PROBLEMATIC_CONSTANTS.includes(parseInt(csv_article.id))) {
    console.log("Getting article", csv_article.id, "from file");
    html = await get_problematic_html(csv_article.id, problematic_dir);
  }
  const sanitized = fixHtml(html);
  const root = html_parse(sanitized);

  const csv_url = get_clean_url(csv_article.title);

  const blocks: OutputBlockData[] = [
    {
      type: "header",
      data: { text: csv_article.title, level: 1 },
    },
  ];

  const image_urls: string[] = [];

  for (const image of root.querySelectorAll("img")) {
    const src = image.getAttribute("src");
    if (!src) throw new Error("No src attribute in image");

    image_urls.push(src);
  }

  images_to_save.push({
    objave_id: csv_article.id,
    serial_id: article_id.toString(),
    url: csv_url,
    images: image_urls,
  });

  for (const node of root.childNodes) {
    if (node.nodeType == NodeType.ELEMENT_NODE) {
      // const is_problem =
      await parse_node(
        node,
        blocks,
        csv_article,
        csv_url,
        article_id,
        problems,
      );

      /* if (is_problem) {
        problematic_articles.push({
          html: sanitized,
          csv: csv_article,
        });
        break;
      } */
    } else if (node.nodeType == NodeType.TEXT_NODE) {
      if (node.text.trim() !== "") throw new Error("Some text: " + node.text);
    } else {
      throw new Error("Unexpected comment: " + node.text);
    }
  }

  // const new_authors = new Set<string>();
  // const not_found_authors = new Set<string>();
  const { current_authors, not_found_authors } = get_authors(
    csv_article,
    blocks,
    authors_by_name,
    all_authors,
  );

  if (not_found_authors.size !== 0) {
    console.error("Authors not found", csv_article.id, not_found_authors);
  }

  await editorJS?.render({
    blocks,
  });

  const format = "D/M/YYYY HH:mm:ss";
  const created_at = parseDate(csv_article.created_at, format);
  const updated_at = parseDate(csv_article.updated_at, format);

  const content = await editorJS?.save();
  if (!content) throw new Error("No content");

  const images = get_image_data_from_editor(content);
  const preview_image = images.length !== 0 ? images[0]?.file.url : undefined;

  if (typeof preview_image === "undefined") {
    console.error("No images in article", csv_article.id, csv_article.title);
  }

  return {
    serial_id: article_id,
    objave_id: csv_article.id,
    title: csv_article.title,
    preview_image,
    content,
    csv_url,
    created_at,
    updated_at,
    author_ids: Array.from(current_authors),
  } satisfies TempArticleType;
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

// TODO: 33 isn't the only one. search for img in p.
// 72, 578
const PROBLEMATIC_CONSTANTS = [
  33, 40, 43, 46, 47, 48, 49, 50, 51, 53, 54, 57, 59, 64, 66, 67, 68, 72, 80,
  90, 92, 114, 164, 219, 225, 232, 235, 243, 280, 284, 333, 350, 355, 476, 492,
  493, 538, 566, 571, 578, 615,
];
