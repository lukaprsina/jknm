import type { OutputData } from "@editorjs/editorjs";
import type { useToast } from "~/hooks/use-toast";
import { convert_title_to_url } from "~/lib/article-utils";
import {
	extract_media_refs_from_content,
	get_heading_from_editor,
} from "~/lib/editor-utils";
import type { ThumbnailType } from "~/lib/validators";
import { editor_store } from "./editor-store";
import { NoHeadingButton, WrongHeadingButton } from "./error-buttons";

export function update_settings_from_editor({
	title,
	url,
	s3_url,
	thumbnail_crop,
	published_at,
	editor_content,
	article_id,
	author_ids,
}: {
	title: string;
	url: string;
	s3_url: string;
	thumbnail_crop: ThumbnailType | null;
	published_at?: Date;
	editor_content: OutputData;
	article_id: string;
	author_ids?: number[];
}) {
	const image_data = extract_media_refs_from_content(editor_content, [
		"image",
	]).map((ref) => ref.data);

	editor_store.setState({
		draft_id: article_id,
		image_data,
		title,
		url,
		s3_url,
		...(thumbnail_crop && { thumbnail_crop }),
		...(published_at && { published_at }),
		...(author_ids && { author_ids }),
	});
}

export function validate_article(
	editor_content: OutputData,
	toaster: ReturnType<typeof useToast>,
) {
	const { title: updated_title, error } =
		get_heading_from_editor(editor_content);

	if (error === "NO_HEADING") {
		toaster.toast({
			title: "Naslov ni nastavljen",
			description: "Prva vrstica mora biti H1 naslov.",
			action: <NoHeadingButton />,
		});
	} else if (error === "WRONG_HEADING_LEVEL") {
		toaster.toast({
			title: "Naslov ni pravilne ravni",
			description: "Prva vrstica mora biti H1 naslov.",
			action: <WrongHeadingButton title={updated_title} />,
		});
	}

	if (!updated_title) return;

	const updated_url = convert_title_to_url(updated_title);

	return { title: updated_title, url: updated_url };
}
