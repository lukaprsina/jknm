import type { OutputData } from "@editorjs/editorjs";
import sanitize_filename from "sanitize-filename";

import type { EditorJSImageData } from "~/components/plugins";

export function get_clean_url(dangerous_url: string) {
  const sanitized = sanitize_filename(dangerous_url, { replacement: "-" });
  return sanitized.toLowerCase().replace(/\s/g, "-");
}

interface HeadingReturnType {
  title?: string;
  error?: "NO_HEADING" | "WRONG_HEADING_LEVEL";
}

export function get_heading_from_editor(
  editor_content: OutputData,
): HeadingReturnType {
  const first_block = editor_content.blocks[0];

  if (first_block?.type === "header") {
    const first_header = first_block.data as {
      text: string;
      level: number;
    };

    const title = first_header.text.trim();
    if (first_header.level === 1) {
      return { title };
    } else {
      return { title, error: "WRONG_HEADING_LEVEL" };
    }
  } else {
    return { error: "NO_HEADING" };
  }
}

export function get_image_data_from_editor(editor_content: OutputData) {
  return editor_content.blocks
    .filter((block) => block.type === "image")
    .map((block) => block.data as EditorJSImageData);
}

export interface EditorJSFileData {
  file: {
    url: string;
    size: number;
    name: string;
    extension: string;
  };
  title: string;
}

export function get_file_data_from_editor(editor_content: OutputData) {
  return editor_content.blocks
    .filter((block) => block.type === "attaches")
    .map((block) => block.data as EditorJSFileData);
}
