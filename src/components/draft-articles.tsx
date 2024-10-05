"use client";

import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { article_variants, article_grid_variants } from "~/lib/page-variants";
import { DraftArticleDrizzleCard } from "./article/adapter";
import { api } from "~/trpc/react";

export function DraftArticles() {
  const drafts = api.article.get_all_drafts.useQuery();

  let sklon: string | undefined;
  if (drafts.data) {
    if (drafts.data.length === 1) {
      sklon = "osnutek";
    } else if (drafts.data.length === 2) {
      sklon = "osnutka";
    } else if (drafts.data.length > 3 && drafts.data.length <= 4) {
      sklon = "osnutki";
    } else {
      sklon = "osnutkov";
    }
  }

  return (
    <AccordionItem value="item-1">
      <AccordionTrigger>
        {drafts.data && drafts.data.length !== 0 ? (
          <span>
            <b>Osnutki</b> ({drafts.data.length} {sklon})
          </span>
        ) : (
          <span>Ni osnutkov</span>
        )}
      </AccordionTrigger>
      <AccordionContent className={article_variants({ variant: "card" })}>
        {drafts.data && drafts.data.length !== 0 ? (
          <div className={article_grid_variants()}>
            {drafts.data.map((article) => (
              <DraftArticleDrizzleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <span>Ni osnutkov</span>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
