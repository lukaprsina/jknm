/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// @ts-expect-error no types
import AttachesTool from "@editorjs/attaches";
// @ts-expect-error no types
import CheckList from "@editorjs/checklist";
import Code from "@editorjs/code";
import Delimiter from "@editorjs/delimiter";
import type { ToolConstructable, ToolSettings } from "@editorjs/editorjs";
// @ts-expect-error no types
import Embed from "@editorjs/embed";
import Header from "@editorjs/header";
import Image from "@editorjs/image";
import InlineCode from "@editorjs/inline-code";
import List from "@editorjs/list";
// @ts-expect-error no types
import Marker from "@editorjs/marker";
import Paragraph from "@editorjs/paragraph";
import Quote from "@editorjs/quote";
import Table from "@editorjs/table";
import Warning from "@editorjs/warning";
import createGenericInlineTool, {
	UnderlineInlineTool,
} from "editorjs-inline-tool";
import {
	upload_file,
	upload_image_by_file,
	upload_image_by_url,
} from "../aws-s3/upload-file";
import InlineFileLinkTool from "./inline-file-link-tool";

export function EDITOR_JS_PLUGINS(): Record<
	string,
	ToolConstructable | ToolSettings
> {
	return {
		image: {
			class: Image,
			inlineToolbar: true,
			config: {
				features: { border: false, caption: true, stretch: false },
				uploader: {
					uploadByFile: (file: File) => upload_image_by_file({ file }),
					uploadByUrl: (url: string) => upload_image_by_url({ url }),
				},
			},
		},
		attaches: {
			class: AttachesTool,
			config: {
				uploader: {
					uploadByFile: (file: File) => upload_file({ file }),
				},
			},
		},
		paragraph: {
			class: Paragraph as ToolConstructable,
			inlineToolbar: true,
		},
		embed: Embed,
		table: {
			// @ts-expect-error no types
			class: Table,
			inlineToolbar: true,
			config: {
				withHeadings: true,
			},
		},
		marker: Marker,
		list: {
			class: List,
			inlineToolbar: true,
			config: {
				defaultStyle: "unordered",
			},
		},
		warning: {
			class: Warning as unknown as ToolConstructable,
			inlineToolbar: true,
		},
		code: Code,
		header: {
			class: Header as unknown as ToolConstructable,
			inlineToolbar: true,
			config: {
				defaultLevel: 2,
			},
		},
		quote: {
			class: Quote,
			inlineToolbar: true,
		},
		checklist: {
			class: CheckList,
			inlineToolbar: true,
		},
		delimiter: Delimiter,
		inlineCode: InlineCode,
		underline: UnderlineInlineTool,
		fileLink: InlineFileLinkTool,
		superscript: createGenericInlineTool({
			sanitize: {
				sup: {},
			},
			tagName: "SUP",
			toolboxIcon: SUPERSCRIPT_ICON,
		}),
		subscript: createGenericInlineTool({
			sanitize: {
				sub: {},
			},
			tagName: "SUB",
			toolboxIcon: SUBSCRIPT_ICON,
		}),
	};
}

const SUPERSCRIPT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-superscript"><path d="m4 19 8-8"/><path d="m12 19-8-8"/><path d="M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06"/></svg>`;
const SUBSCRIPT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-subscript"><path d="m4 5 8 8"/><path d="m12 5-8 8"/><path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07"/></svg>`;
