import { create_content_page } from "~/components/article/published-article-page";

const { generateMetadata, Page } = create_content_page("publiciranje");

export { generateMetadata };
export default Page;
