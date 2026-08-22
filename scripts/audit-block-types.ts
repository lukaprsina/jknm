import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * Report-only: which editorjs block `type`s actually appear in `content_json`
 * across all articles, vs. which tools are registered in
 * src/components/editor/plugins.ts. Answers "what does editor-to-react.tsx
 * need a case for" without guessing from the plugin list alone.
 */

const rows = await db
	.select({ id: Article.id, content_json: Article.content_json })
	.from(Article);

const type_counts = new Map<string, number>();

for (const row of rows) {
	for (const block of row.content_json?.blocks ?? []) {
		type_counts.set(block.type, (type_counts.get(block.type) ?? 0) + 1);
	}
}

const sorted = [...type_counts.entries()].sort((a, b) => b[1] - a[1]);

console.log(`${rows.length} articles scanned\n`);
console.log("block type -> count");
for (const [type, count] of sorted) {
	console.log(`${type}\t${count}`);
}

process.exit(0);
