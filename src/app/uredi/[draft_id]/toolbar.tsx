"use client";

import { use, useMemo } from "react";
import { AllAuthorsContext } from "~/app/provider";
import { useEditorContext } from "~/components/editor/editor-context";
import { editor_store, useAuthorIds } from "~/components/editor/editor-store";
import type { MultiSelectOption } from "~/components/ui/multi-select";
import { MultiSelect } from "~/components/ui/multi-select";
import { format_author_name } from "~/lib/author-name";
import { ToolbarButtons } from "./toolbar-buttons";

export function MyToolbar() {
	const editor_context = useEditorContext();
	const all_authors = use(AllAuthorsContext);
	const author_ids = useAuthorIds();

	const selected_values = useMemo(
		() => author_ids.map((id) => id.toString()),
		[author_ids],
	);

	const options: MultiSelectOption[] = useMemo(
		() =>
			all_authors.map((author) => ({
				value: author.id.toString(),
				label: format_author_name(author),
			})),
		[all_authors],
	);

	return (
		<div className="flex w-full flex-wrap items-center justify-between p-4">
			<div className="flex items-center gap-2">
				<MultiSelect
					autoSize
					hideSelectAll
					options={options}
					defaultValue={selected_values}
					onValueChange={(values) =>
						editor_store.setState({
							author_ids: values.map((value) => Number.parseInt(value, 10)),
						})
					}
					placeholder="Avtorji"
				/>
				{editor_context.statusText && (
					<pre className="prose bg-background text-accent-foreground h-10 flex shrink-0 whitespace-pre-wrap text-sm">
						{editor_context.statusText}
					</pre>
				)}
			</div>
			{editor_context.state === "ready" && <ToolbarButtons />}
		</div>
	);
}
