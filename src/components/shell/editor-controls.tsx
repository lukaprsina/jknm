import { getServerAuthSession } from "~/server/auth";
import type { EditableArticleRef } from "../article/new-adapter";
import EditingButtons from "./editing-buttons";

/**
 * The one place in the shell that reads the session (#31 step 3).
 *
 * `Shell` used to await the session itself, which made all 10 routes that
 * render it wait on a DB round-trip before emitting any HTML. Isolating the
 * read here lets the caller put it behind `<Suspense>`, so the rest of the
 * page streams while the session resolves.
 *
 * Only a primitive crosses the boundary: `EditingButtons` never needed the
 * session object, only whether there is one. Signed-in is equivalent to admin
 * here because `sign-in-gate.ts` only admits verified @jknm.si identities, which
 * is why the flag is `is_admin` — the same name, fed the same `Boolean(session)`,
 * as `is_visible_to` in `lifecycle-rules.ts`.
 */
export async function EditorControls({
	published_article,
}: {
	published_article?: EditableArticleRef;
}) {
	const session = await getServerAuthSession();

	return (
		<EditingButtons
			published_article={published_article}
			is_admin={Boolean(session)}
		/>
	);
}
