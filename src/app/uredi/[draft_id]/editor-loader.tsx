"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { article_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";

// @editorjs/editorjs patches `Element.prototype` at module-eval time with no
// `typeof document` guard, so it throws "Element is not defined" if the
// module is ever evaluated during SSR — must stay client-only. `ssr: false`
// is only allowed inside a Client Component, hence this wrapper.
const Editor = dynamic(() => import("./editor"), {
	ssr: false,
	loading: () => (
		<div className={cn("flex flex-col gap-6", article_variants())}>
			<Card className="mx-auto w-full">
				<CardHeader>
					<Skeleton className="h-18 w-full bg-[hsl(0_0%_90%)]" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-96.5 w-full bg-[hsl(0_0%_90%)]" />
				</CardContent>
			</Card>
		</div>
	),
});

export default Editor;
