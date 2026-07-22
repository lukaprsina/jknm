import { StaticPageToc } from "~/components/toc/static-page-toc";
import Content, { tableOfContents } from "./content.mdx";

export { metadata } from "./content.mdx";

export default function Page() {
	return (
		<>
			<StaticPageToc toc={tableOfContents} />
			<Content />
		</>
	);
}
