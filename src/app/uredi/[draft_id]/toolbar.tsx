"use client";

import { use, useContext, useMemo } from "react";
import { AllAuthorsContext } from "~/app/provider";
import type { AuthorOption } from "~/components/author-command-popover";
import { AuthorCommandPopover } from "~/components/author-command-popover";
import { EditorContext } from "~/components/editor/editor-context";
import { editor_store, useAuthorIds } from "~/components/editor/editor-store";
import { format_author_name } from "~/lib/author-name";
import { ToolbarButtons } from "./toolbar-buttons";

export function MyToolbar() {
	const editor_context = useContext(EditorContext);
	const all_authors = use(AllAuthorsContext);
	const author_ids = useAuthorIds();

	const selected_values = useMemo(
		() => author_ids.map((id) => id.toString()),
		[author_ids],
	);

	const options: AuthorOption[] = useMemo(
		() =>
			all_authors.map((author) => ({
				value: author.id.toString(),
				author,
				label: format_author_name(author),
			})),
		[all_authors],
	);

	if (!editor_context) return null;
	return (
		<div className="flex flex-col justify-between gap-4">
			<div className="flex w-full flex-wrap items-center justify-between p-4">
				<div className="flex items-center gap-2">
					<AuthorCommandPopover
						className="w-auto"
						options={options}
						selectedValues={selected_values}
						onToggle={(value) => {
							const id = Number.parseInt(value, 10);
							const next_ids = selected_values.includes(value)
								? author_ids.filter((author_id) => author_id !== id)
								: [...author_ids, id];
							editor_store.setState({ author_ids: next_ids });
						}}
						onClear={() => editor_store.setState({ author_ids: [] })}
						placeholder="Avtorji"
					/>
					<span className="flex flex-shrink-0">
						{editor_context.savingText}
					</span>
				</div>
				<ToolbarButtons />
			</div>
		</div>
	);
}
