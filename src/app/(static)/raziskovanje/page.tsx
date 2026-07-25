import type { Metadata } from "next";
import { StaticPageToc } from "~/components/toc/static-page-toc";
import Content, {
	metadata as content_metadata,
	tableOfContents,
} from "./content.mdx";

export const metadata: Metadata = {
	...content_metadata,
	alternates: { canonical: "/raziskovanje" },
};

export default function Page() {
	return (
		<>
			<StaticPageToc toc={tableOfContents} />
			<Content />
		</>
	);
}
