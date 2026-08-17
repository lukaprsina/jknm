import type { API, InlineTool, SanitizerConfig } from "@editorjs/editorjs";
import { upload_file } from "../aws-s3/upload-file";

/**
 * Inline Tool: pick a file (PDF), upload it, and wrap the selection (or, if
 * nothing is selected, the uploaded filename) in a plain `<a href>` — the
 * shape every pre-rewrite article uses for PDFs. `@editorjs/attaches` is a
 * Block Tool (a card widget); this is the missing inline counterpart,
 * modeled on the core `link` Inline Tool (vendor/editorjs/src/components/
 * inline-tools/inline-tool-link.ts), swapping its URL prompt for a file
 * upload via the same `upload_file` used by the image/attaches tools.
 */

/**
 * Shared across every block's tool instance (EditorJS instantiates one
 * InlineFileLinkTool per block that has `inlineToolbar: true`) so we don't
 * append a new hidden `<input>` to `document.body` per block.
 */
let shared_file_input: HTMLInputElement | null = null;

function get_shared_file_input(): HTMLInputElement {
	shared_file_input ??= (() => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "application/pdf";
		input.style.display = "none";
		document.body.appendChild(input);
		return input;
	})();
	return shared_file_input;
}

/**
 * Opens the native file picker and resolves with the chosen file, or `null`
 * if the user cancels. Cancel isn't just "no change event": without handling
 * it, the caller's fake selection background/save from `surround()` would
 * never be cleaned up, leaving the text visibly stuck in the "selected"
 * highlight. The `focus` fallback covers browsers where the `cancel` event
 * on `<input type="file">` isn't supported.
 */
function pick_pdf_file(): Promise<File | null> {
	const input = get_shared_file_input();
	input.value = "";

	return new Promise((resolve) => {
		let settled = false;
		const finish = (file: File | null) => {
			if (settled) return;
			settled = true;
			input.removeEventListener("change", on_change);
			input.removeEventListener("cancel", on_cancel);
			window.removeEventListener("focus", on_focus);
			resolve(file);
		};
		const on_change = () => finish(input.files?.[0] ?? null);
		const on_cancel = () => finish(null);
		const on_focus = () => {
			// Give a real `change`/`cancel` event a chance to land first.
			setTimeout(() => finish(input.files?.[0] ?? null), 250);
		};

		input.addEventListener("change", on_change);
		input.addEventListener("cancel", on_cancel);
		window.addEventListener("focus", on_focus, { once: true });
		input.click();
	});
}

export default class InlineFileLinkTool implements InlineTool {
	public static isInline = true;
	public static title = "File link";

	public static get sanitize(): SanitizerConfig {
		return {
			a: { href: true, target: "_blank", rel: "nofollow" },
		};
	}

	private readonly api: API;
	private button: HTMLButtonElement | null = null;
	private was_collapsed = false;

	constructor({ api }: { api: API }) {
		this.api = api;
	}

	public render(): HTMLElement {
		this.button = document.createElement("button");
		this.button.type = "button";
		this.button.classList.add("ce-inline-tool", "file-link-tool");
		this.button.innerHTML = FILE_LINK_ICON;
		return this.button;
	}

	public surround(range: Range | null): void {
		if (!range) return;

		const parent_anchor = this.api.selection.findParentTag("A");
		if (parent_anchor) {
			this.api.selection.expandToTag(parent_anchor);
			document.execCommand("unlink");
			return;
		}

		this.was_collapsed = range.collapsed;
		this.api.selection.setFakeBackground();
		this.api.selection.save();
		void this.handle_file_selected();
	}

	public checkState(): boolean {
		const anchor = this.api.selection.findParentTag("A");
		this.button?.classList.toggle("ce-inline-tool--active", !!anchor);
		return !!anchor;
	}

	private async handle_file_selected(): Promise<void> {
		const file = await pick_pdf_file();

		this.api.selection.restore();
		this.api.selection.removeFakeBackground();

		if (!file) return;

		const result = await upload_file({ file });
		if (!result.success || !result.file || !("title" in result.file)) {
			this.api.notifier.show({
				message: "Nalaganje datoteke ni uspelo",
				style: "error",
			});
			return;
		}

		const { url, title } = result.file;
		if (this.was_collapsed) {
			document.execCommand(
				"insertHTML",
				false,
				`<a href="${escape_html(url)}">${escape_html(title)}</a>`,
			);
		} else {
			document.execCommand("createLink", false, url);
		}
	}
}

function escape_html(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

const FILE_LINK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paperclip-icon lucide-paperclip"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>`;
