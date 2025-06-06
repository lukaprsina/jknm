import sanitize_filename from "sanitize-filename";
import { v4 as uuid4 } from "uuid";
import { format_date_for_url } from "./format-date";
import path from "path";
import DOMPurify from "isomorphic-dompurify";

export function convert_filename_to_url(dangerous_url: string) {
  const fs_parsed = path.parse(dangerous_url);
  const converted_name = convert_title_to_url(fs_parsed.name);
  // return path.join(fs_parsed.dir, converted_name + fs_parsed.ext);
  return converted_name + fs_parsed.ext;
}

export function convert_title_to_url(dangerous_url: string) {
  const clean = DOMPurify.sanitize(dangerous_url, {
    ALLOWED_TAGS: [],
  });

  const sanitized = sanitize_filename(clean, { replacement: "" });
  const replaced = sanitized
    .toLowerCase()
    .replace(/–/g, "-")
    .replace(/[čšž]/g, (match) => {
      switch (match) {
        case "č":
          return "c";
        case "š":
          return "s";
        case "ž":
          return "z";
        default:
          return match;
      }
    })
    .replace(/[^a-zA-Z0-9\-_\s]/g, "")
    // Replace spaces or sequences of spaces, underscores, or hyphens with a single hyphen
    .replace(/[\s-]+/g, "-")
    .replace(/_+/g, "_")
    // Remove leading or trailing hyphens
    .replace(/^-+|-+$/g, "")
    .replace(/^_+|_+$/g, "")
    .trim();

  // remove leading and trailing dashes and underscores
  const replaced_split = replaced
    .split(/[\s+]/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (replaced_split.length === 0) return uuid4();
  return replaced_split.join("-");
}

export function get_s3_published_directory(
  article_url: string,
  created_at: Date | number,
) {
  const date = new Date(created_at);
  return `${article_url}-${format_date_for_url(date)}`;
}

export function get_s3_draft_directory(id: number) {
  return `${id}`;
}

export function get_draft_article_link(id: number) {
  return `/uredi/${id}`;
}

export function get_published_article_link(
  url: string,
  created_at: Date | number,
  duplicate_article_urls: string[] | undefined,
) {
  const date = new Date(created_at);

  const name = duplicate_article_urls?.includes(url)
    ? `${url}?dan=${format_date_for_url(date)}`
    : url;

  /* console.log("get_published_article_link", {
    url,
    date,
    duplicate_article_urls,
    name,
  }); */

  return `/novica/${name}`;
}
