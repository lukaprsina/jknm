import sanitize_filename from "sanitize-filename";
import { v4 as uuid4 } from "uuid";

export function convert_title_to_url(dangerous_url: string) {
  const sanitized = sanitize_filename(dangerous_url, { replacement: "" });
  const encoded = sanitized.replace(/[^a-zA-Z0-9čČžŽšŠ\s]/g, "").trim();
  const ws_replaced = encoded.toLowerCase().replace(/\s/g, "-");
  if (ws_replaced === "") return uuid4();
  return ws_replaced;
}

export function get_link_from_article(url: string, created_at: Date) {
  return "";
}
