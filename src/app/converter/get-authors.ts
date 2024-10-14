import type { OutputBlockData } from "@editorjs/editorjs";
import { decode } from "html-entities";
import { parse as html_parse } from "node-html-parser";

import type { ImportedArticle } from "./converter-spaghetti";
import type { Author } from "~/server/db/schema";

export interface AuthorType {
  name: string;
  ids: string[];
  change?: false | string;
}

export function get_authors(
  imported_article: ImportedArticle,
  all_blocks: OutputBlockData[],
  authors_by_name: AuthorType[],
  all_authors: (typeof Author.$inferSelect)[],
) {
  // const all_authors = await api.author.get_all();
  let number_of_paragraphs = 3;

  const last_paragraphs: string[] = [];

  for (let i = all_blocks.length - 1; i >= 0; i--) {
    const block = all_blocks.at(i);
    if (!block) throw new Error("No block at index " + i);

    if (block.type !== "paragraph") continue;

    const paragraph_data = block.data as { text: string };
    // console.log(paragraph_data.text);
    const trimmed = decode(paragraph_data.text).trim();
    // const trimmed = paragraph_data.text.trim();
    if (trimmed === "") continue;

    last_paragraphs.push(trimmed);
    number_of_paragraphs--;
    if (number_of_paragraphs === 0) {
      break;
    }
  }

  last_paragraphs.reverse();

  if (last_paragraphs.length === 0) {
    console.error(
      "get authors -> no paragraphs: " + imported_article.objave_id,
    );
  }

  const current_authors = new Set<number>();
  const not_found_authors = new Set<string>();

  for (const paragraph of last_paragraphs) {
    const root = html_parse(paragraph);
    const bold_elements = root.querySelectorAll("b");

    for (const bold_element of bold_elements) {
      const trimmed = bold_element.text
        .trim()
        .replaceAll(/\s+/g, " ")
        .replaceAll(":", "")
        .replaceAll(".", "");

      if (trimmed === "") continue;

      const author_by_name = authors_by_name.find((a) => a.name === trimmed);
      if (!author_by_name) {
        console.error("Author not found", trimmed);
        continue;
      }

      let author = author_by_name.name;
      if (typeof author_by_name.change === "boolean") {
        continue;
      } else if (typeof author_by_name.change === "string") {
        author = author_by_name.change;
      }

      author = author.trim();
      const split_authors = author.split(", ");

      for (const split_author of split_authors) {
        process_author(
          split_author,
          not_found_authors,
          current_authors,
          all_authors,
        );
      }
    }
  }

  if (not_found_authors.size !== 0) {
    console.log({ not_found_authors });
    throw new Error(
      `Authors not found, id: ${imported_article.objave_id}, size: ${not_found_authors.size}`,
    );
  }

  return current_authors;
}

function process_author(
  split_author: string,
  not_found_authors: Set<string>,
  current_authors: Set<number>,
  all_authors: (typeof Author.$inferSelect)[],
  // csv_article: CSVType,
) {
  let index: number | undefined = undefined;

  for (let i = 0; i < all_authors.length; i++) {
    const db_author = all_authors[i];
    if (!db_author) throw new Error("No author at index " + i);

    if (db_author.name === split_author) {
      if (typeof index === "number") {
        throw new Error(`Multiple authors with the same name: ${split_author}`);
      }

      index = i;
    }
  }

  if (typeof index === "undefined") {
    not_found_authors.add(split_author);
  } else {
    const author = all_authors[index];
    if (!author) throw new Error("No author at index " + index);
    // console.log("adding author", csv_article.id, author);
    current_authors.add(author.id);
  }
}
