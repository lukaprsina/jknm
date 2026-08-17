import { create_content_page } from "~/components/article/published-article-page";

export const dynamic = "force-dynamic";

const { generateMetadata, Page } = create_content_page("zgodovina");

export { generateMetadata };
export default Page;
