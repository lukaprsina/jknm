import { cn } from "@acme/ui";

import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";

export default function FourOFour() {
  return (
    <Shell>
      <div className={cn(article_variants(), page_variants())}>
        <h1>404</h1>
        <p>Page not found</p>
      </div>
    </Shell>
  );
}
