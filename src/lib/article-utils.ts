import sanitize_filename from "sanitize-filename";
import { v4 as uuid4 } from "uuid";
import { format_date_for_url } from "./format-date";

export function convert_title_to_url(dangerous_url: string) {
  const sanitized = sanitize_filename(dangerous_url, { replacement: "" });
  const replaced = sanitized
    .replace(/[^a-zA-Z0-9čČžŽšŠ\s]/g, "")
    .trim()
    .toLowerCase();

  const replaced_split = replaced
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (replaced_split.length === 0) return uuid4();
  return replaced_split.join("-");
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

  return `/novica/${name}`;
}
