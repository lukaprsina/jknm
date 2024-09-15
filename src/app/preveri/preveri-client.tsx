"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { article_variants, page_variants } from "~/lib/page-variants";
import { api } from "~/trpc/react";
import { useToast } from "~/hooks/use-toast";
import { cn } from "~/lib/utils";
import { EditButton } from "~/components/shell/editing-buttons";
import { EditorToReact } from "~/components/editor/editor-to-react";

import { InfoCard } from "~/components/info-card";

export function PreveriClient({
  articles,
  // csv_articles,
}: {
  articles: {
    id: number;
    old_id: number | null;
  }[];
  // csv_articles: CSVType[];
}) {
  const toaster = useToast();
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState(1);
  const router = useRouter();

  const page_info = useMemo(() => {
    const article_index = articles.findIndex(
      (article) => article.old_id === page,
    );

    if (article_index === -1) {
      return {
        next: NaN,
        previous: NaN,
        current_id: NaN,
      };
    }

    if (!articles[article_index]?.id) {
      return {
        next: NaN,
        previous: NaN,
        current_id: NaN,
      };
    }

    return {
      next: articles[article_index + 1]?.old_id ?? NaN,
      previous: articles[article_index - 1]?.old_id ?? NaN,
      current_id: articles[article_index]?.id,
    };
  }, [articles, page]);

  const article = api.article.get_published_by_id.useQuery(
    page_info.current_id,
  );

  useEffect(() => {
    console.log("useEffect", page, page_info)
  }, [page, page_info]);

  const iframe_src = useCallback(
    (id: number) => `https://www.jknm.si/si/?id=${id}`,
    [],
  );

  useEffect(() => {
    router.prefetch(iframe_src(page_info.next));
    router.prefetch(iframe_src(page_info.previous));
  }, [iframe_src, page_info.next, page_info.previous, router]);

  return (
    <div className={cn(article_variants(), page_variants(), "max-w-none px-6")}>
      <h2>Preveri</h2>
      <p>Stran {page}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          console.log("form onsubmit");
          const article_index = articles.findIndex(
            (article) => article.old_id === inputPage,
          );

          if (article_index === -1) {
            toaster.toast({
              title: `Stran z ID ${inputPage} ne obstaja`,
            });

            return;
          }

          setPage(inputPage);
        }}
        className="my-8 flex items-center gap-4"
      >
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={isNaN(page_info.previous)}
            onClick={() => setPage(page_info.previous)}
          >
            Prejšnja: {page_info.previous}
          </Button>
          <Button
            type="button"
            disabled={isNaN(page_info.next)}
            onClick={() => {
              console.log("next", {page_info})
              setPage(page_info.next)
            }}
          >
            Naslednja: {page_info.next}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            id="stran"
            value={inputPage}
            onChange={(event) => {
              const number = parseInt(event.target.value);
              setInputPage(number);
            }}
          />
          <Button type="submit">Pojdi</Button>
          {article.data && (
            <EditButton variant="outline" published_article_id={article.data.id} new_tab />
          )}
        </div>
      </form>
      <div className="grid h-full w-full grid-cols-2 gap-2">
        {article.data ? (
          <>
            <iframe
              className="h-full w-full overflow-y-hidden rounded-xl"
              src={iframe_src(page)}
            />
            <EditorToReact article={article.data} session={null} />
          </>
        ) : (
          <InfoCard title="Nekaj je narobe" description="Pokliči me" />
        )}
      </div>
    </div>
  );
}
