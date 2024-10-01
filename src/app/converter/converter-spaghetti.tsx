"use client";

import type EditorJS from "@editorjs/editorjs";
import type { OutputBlockData } from "@editorjs/editorjs";
import dom_serialize from "dom-serializer";
import { parseDocument } from "htmlparser2";
import { parse as html_parse, NodeType } from "node-html-parser";
import { decode as html_decode_entities } from "html-entities";
import type { AuthorType } from "./get-authors";
import {
  get_authors_by_name,
  get_problematic_html,
  save_file_data,
  upload_articles,
} from "./converter-server";
import { get_authors } from "./get-authors";
import { parse_node } from "./parse-node";
import type { RouterOutputs } from "~/trpc/react";
import { read_from_xml } from "./xml-server";
import { PROBLEMATIC_CONSTANTS } from "./info/problematic";
import { convert_title_to_url } from "~/lib/article-utils";
import type { PublishArticleSchema } from "~/server/db/schema";
import type { z } from "zod";
import type { ThumbnailType } from "~/lib/validators";
import { centerCrop, makeAspectCrop } from "react-image-crop";
import { get_s3_prefix } from "~/lib/s3-publish";
import { env } from "~/env";
import { subMinutes } from "date-fns";

export type ConverterArticleWithAuthorIds = z.infer<
  typeof PublishArticleSchema
> & {
  author_ids: number[];
};

export interface FilesToSave {
  objave_id: number;
  // serial_id: string;
  url: string;
  images: DimensionType[];
  files: FileInfo[];
  created_at: Date;
  thumbnail_crop: ThumbnailType | undefined;
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
  fs_name: string;
  image_name: string;
  old_path: string;
}

export interface ImageInfo {
  thumbnail_crop: ThumbnailType | undefined;
  images: DimensionType[];
}

export interface FileInfo {
  old_path: string;
  fs_name: string;
}

export interface IdsByDimentionType {
  dimensions: { width: number; height: number };
  ids: number[];
}

export type InitialProblems = Record<ProblemKey, [number, string][]>;

const initial_problems: InitialProblems = {
  images_no_div: [],
  single_in_div: [],
  just_text_in_div: [],
  nm: [],
  superscript: [],
  superscript_ws: [],
  empty_divs: [],
  problematic_articles: [],
  image_in_caption: [],
  videos: [],
  videos_no_id: [],
  empty_captions: [],
  unexpected_in_div: [],
  link_ends_punct_or_ws: [],
  link_internal: [],
  link_jknmsi: [],
  link_external: [],
};

export type ProblemKey =
  | "images_no_div"
  | "single_in_div"
  | "just_text_in_div"
  | "nm"
  | "superscript"
  | "superscript_ws"
  | "empty_divs"
  | "problematic_articles"
  | "image_in_caption"
  | "videos"
  | "videos_no_id"
  | "empty_captions"
  | "unexpected_in_div"
  | "link_ends_punct_or_ws"
  | "link_internal"
  | "link_jknmsi"
  | "link_external";

const files_to_save: FilesToSave[] = [];
const articles_without_authors = new Set<number>();
const authors_by_id: { id: string; names: string[] }[] = [];
let authors_by_name: AuthorType[] = [];
const ids_by_dimensions: IdsByDimentionType[] = [];

export async function iterate_over_articles(
  editorJS: EditorJS | null,
  do_splice: boolean,
  do_dry_run: boolean,
  _do_update: boolean,
  do_dimensions: boolean,
  first_article: number,
  last_article: number,
  all_authors: RouterOutputs["author"]["get_all"],
) {
  if (false as boolean) {
    return;
  }

  const problems = initial_problems;

  files_to_save.length = 0;
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
  // let article_id = do_splice && first_index !== -1 ? first_index + 1 : 1;

  authors_by_name = await get_authors_by_name();

  const csv_ids = imported_articles.map((a) => a.objave_id);

  for (const csv_article of sliced_csv_articles) {
    const article = await parse_csv_article(
      csv_article,
      editorJS,
      csv_ids,
      all_authors,
      authors_by_name,
      do_dimensions,
      problems,
    );
    articles.push(article);
  }

  console.log("done", articles);
  if (!do_dry_run) {
    await upload_articles(articles);
  }

  await save_file_data(files_to_save);
  // console.warn("Images to save", images_to_save);

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
  csv_ids: number[],
  all_authors: RouterOutputs["author"]["get_all"],
  authors_by_name: AuthorType[],
  do_dimensions: boolean,
  problems: InitialProblems,
): Promise<ConverterArticleWithAuthorIds> {
  const problematic_dir = "1723901265154";

  let html = imported_article.content;
  if (PROBLEMATIC_CONSTANTS.includes(imported_article.objave_id)) {
    console.log(
      "Getting draft_article",
      imported_article.objave_id,
      "from file",
    );
    html = await get_problematic_html(
      imported_article.objave_id,
      problematic_dir,
    );
  }

  html = fixHtml(html);
  const root = html_parse(html);

  // is image in div
  {
    const images = root.querySelectorAll("img");
    for (const image of images) {
      const possible_div_1 = image.parentNode;
      const possible_div_2 = possible_div_1.parentNode;
      const valid =
        possible_div_1.tagName === "DIV" || possible_div_2.tagName === "DIV";

      if (!valid) {
        console.log(
          "Parsing draft_article",
          imported_article.objave_id,
          root.structure,
        );
        console.warn(
          "Images isn't in div",
          imported_article.objave_id,
          image.outerHTML,
          { first: possible_div_1.tagName, second: possible_div_2.tagName },
        );
        problems.images_no_div.push([
          imported_article.objave_id,
          image.outerHTML,
        ]);
        // throw new Error("Images in p");
      }
    }
  }

  const currentLocalDate = new Date();
  const created_at = subMinutes(
    imported_article.created_at,
    currentLocalDate.getTimezoneOffset(),
  );
  const updated_at = subMinutes(
    imported_article.updated_at,
    currentLocalDate.getTimezoneOffset(),
  );

  const converted_url = convert_title_to_url(imported_article.title);
  const converted_title = html_decode_entities(imported_article.title);

  const blocks: OutputBlockData[] = [
    {
      type: "header",
      data: { text: converted_title, level: 1 },
    },
  ];

  const image_info: ImageInfo = {
    thumbnail_crop: undefined,
    images: [],
  };

  const file_info: FileInfo[] = [];

  for (const node of root.childNodes) {
    if (node.nodeType == NodeType.ELEMENT_NODE) {
      await parse_node(
        node,
        blocks,
        created_at,
        imported_article,
        converted_url,
        csv_ids,
        problems,
        do_dimensions,
        ids_by_dimensions,
        image_info,
        file_info,
      );
    } else if (node.nodeType == NodeType.TEXT_NODE) {
      if (node.text.trim() !== "") throw new Error("Some text: " + node.text);
    } else {
      throw new Error("Unexpected comment: " + node.text);
    }
  }

  {
    const first_image = image_info.images[0];

    const width = first_image?.width;
    const height = first_image?.height;

    if (width && height) {
      const image_url = get_s3_prefix(
        first_image.fs_name,
        env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
      );
      image_info.thumbnail_crop = {
        image_url,
        ...centerCrop(
          makeAspectCrop(
            {
              unit: "%",
              width: 100,
            },
            16 / 9,
            width,
            height,
          ),
          width,
          height,
        ),
      } satisfies ThumbnailType;
    }
  }

  // console.log("image_info", image_info);
  files_to_save.push({
    objave_id: imported_article.objave_id,
    url: converted_url,
    images: image_info.images,
    files: file_info,
    created_at,
    thumbnail_crop: image_info.thumbnail_crop,
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

  return {
    old_id: imported_article.objave_id,
    title: converted_title,
    content,
    url: converted_url,
    created_at,
    updated_at,
    author_ids: Array.from(current_authors),
    thumbnail_crop: image_info.thumbnail_crop,
  } satisfies ConverterArticleWithAuthorIds;
}

function fixHtml(htmlString: string) {
  const document = parseDocument(htmlString, {
    decodeEntities: true,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    recognizeSelfClosing: true,
  });

  return dom_serialize(document);
}
