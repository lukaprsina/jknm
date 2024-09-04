/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { ToolConstructable, ToolSettings } from "@editorjs/editorjs";
// @ts-expect-error no types
import AttachesTool from "@editorjs/attaches";
// @ts-expect-error no types
import CheckList from "@editorjs/checklist";
// @ts-expect-error no types
import Code from "@editorjs/code";
import Delimiter from "@editorjs/delimiter";
// @ts-expect-error no types
import Embed from "@editorjs/embed";
import Header from "@editorjs/header";
import Image from "@editorjs/image";
import InlineCode from "@editorjs/inline-code";
import List from "@editorjs/list";
// @ts-expect-error no types
import Marker from "@editorjs/marker";
// @ts-expect-error no types
import Paragraph from "@editorjs/paragraph";
import Quote from "@editorjs/quote";
import Table from "@editorjs/table";
// @ts-expect-error no types
import Warning from "@editorjs/warning";
import { UnderlineInlineTool } from "editorjs-inline-tool";
import {
  upload_file,
  upload_image_by_file,
  upload_image_by_url,
} from "../aws-s3/upload-file";

export function EDITOR_JS_PLUGINS(): Record<
  // toast: ReturnType<typeof useToast>,
  string,
  ToolConstructable | ToolSettings
> {
  return {
    image: {
      // @ts-expect-error no types
      class: Image,
      // inlineToolbar: ["link"],
      inlineToolbar: true,
      config: {
        uploader: {
          uploadByFile: (file: File) => upload_image_by_file(file),
          uploadByUrl: (url: string) => upload_image_by_url(url),
        },
      },
    },
    attaches: {
      class: AttachesTool,
      config: {
        uploader: {
          uploadByFile: (file: File) => upload_file(file),
        },
      },
    },
    paragraph: {
      class: Paragraph,
      inlineToolbar: true,
    },
    embed: Embed,
    table: {
      // @ts-expect-error no types
      class: Table,
      // inlineToolbar: true,
      config: {
        withHeadings: true,
      },
    },
    marker: Marker,
    list: {
      // @ts-expect-error no types
      class: List,
      inlineToolbar: true,
      config: {
        defaultStyle: "unordered",
      },
    },
    warning: Warning,
    code: Code,
    // linkTool: LinkTool,
    header: {
      // @ts-expect-error no types
      class: Header,
      inlineToolbar: true,
      config: {
        defaultLevel: 2,
      },
    },
    quote: Quote,
    checklist: CheckList,
    delimiter: Delimiter,
    inlineCode: InlineCode,
    underline: UnderlineInlineTool,
  };
}

/* const BOLD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bold"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`;
const ITALIC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-italic"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`;
const UNDERLINE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-underline"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>`; */