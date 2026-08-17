import { create_content_page } from "~/components/article/published-article-page";

export const dynamic = "force-dynamic";

const { generateMetadata, Page } = create_content_page("raziskovanje");

export { generateMetadata };
export default Page;
