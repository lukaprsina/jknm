"use server";

import type { OutputBlockData } from "@editorjs/editorjs";
import { decode } from "html-entities";
import { parse as html_parse } from "node-html-parser";

import { type CSVType } from "./converter-server";
import { api } from "~/trpc/server";
import { RouterOutputs } from "~/trpc/react";

export interface AuthorType {
  name: string;
  ids: string[];
  change?: false | string;
}

export async function get_authors(
  csv_article: CSVType,
  all_blocks: OutputBlockData[],
  authors_by_name: AuthorType[],
  all_authors: RouterOutputs["author"]["get_all"],
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
    console.error("get authors -> no paragraphs: " + csv_article.id);
  }

  const current_authors = new Set<number>();
  const not_found_authors = new Set<string>();

  for (const paragraph of last_paragraphs) {
    const root = html_parse(paragraph);
    const strongs = root.querySelectorAll("strong");

    for (const strong of strongs) {
      const trimmed = strong.text
        .trim()
        .replace(/\s+/g, " ")
        .replace(":", "")
        .replace(".", "");

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
          all_authors,
          not_found_authors,
          current_authors,
          // csv_article,
        );
      }
    }
  }

  if (not_found_authors.size !== 0) {
    console.log({ not_found_authors });
    throw new Error(
      `Authors not found, id: ${csv_article.id}, size: ${not_found_authors.size}`,
    );
  }

  return current_authors;
}

function process_author(
  split_author: string,
  all_authors: RouterOutputs["author"]["get_all"],
  not_found_authors: Set<string>,
  current_authors: Set<number>,
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
