"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { useToast } from "~/hooks/use-toast";
import { EditButton } from "~/components/shell/editing-buttons";
import { EditorToReact } from "~/components/editor/editor-to-react";

import { InfoCard } from "~/components/info-card";
import { createStore } from "zustand-x";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { get_article_by_published_id } from "~/server/article/get-article";

export interface PreveriStoreType {
  index: number;
}

const initial_data = {
  index: 1,
} satisfies PreveriStoreType;

export const preveri_store = createStore("preveri")<PreveriStoreType>(
  initial_data,
  {
    persist: {
      enabled: true,
    },
  },
);

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
  const [inputPage, setInputPage] = useState(1);
  const router = useRouter();
  const preveri_store_index = preveri_store.use.index();

  const page_info = useMemo(() => {
    const article_index = articles.findIndex(
      (article) => article.old_id === preveri_store_index,
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
  }, [articles, preveri_store_index]);

  const article = useQuery({
    queryKey: ["preveri-client", page_info.current_id],
    queryFn: () =>
      get_article_by_published_id({ published_id: page_info.current_id }),
  });

  const iframe_src = useCallback(
    (id: number) => `https://www.jknm.si/si/?id=${id}`,
    [],
  );

  useEffect(() => {
    router.prefetch(iframe_src(page_info.next));
    router.prefetch(iframe_src(page_info.previous));
  }, [iframe_src, page_info.next, page_info.previous, router]);

  const page = useMemo(() => {
    if (article.isPending) {
      return "Nalagam...";
    } else if (article.isError) {
      return (
        <InfoCard
          title="Nekaj je narobe, pokliči me"
          description={article.error.message}
        />
      );
    } else {
      return <EditorToReact article={article.data.published} session={null} />;
    }
  }, [article]);

  return (
    <>
      <h1>Preveri: ID {preveri_store_index}</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          // console.log("form onsubmit");
          const article_index = articles.findIndex(
            (article) => article.old_id === inputPage,
          );

          if (article_index === -1) {
            toaster.toast({
              title: `Stran z ID ${inputPage} ne obstaja`,
            });

            return;
          }

          preveri_store.set.index(inputPage);
        }}
        className="my-8 flex items-center gap-4"
      >
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={isNaN(page_info.previous)}
            onClick={() => preveri_store.set.index(page_info.previous)}
          >
            Prejšnja: {page_info.previous}
          </Button>
          <Button
            type="button"
            disabled={isNaN(page_info.next)}
            onClick={() => preveri_store.set.index(page_info.next)}
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
            <EditButton
              type="button"
              variant="outline"
              published_article_id={article.data.published?.id ?? -1}
              new_tab
            />
          )}
        </div>
      </form>
      <div className="grid h-full w-full grid-cols-2 gap-2">
        <>
          <iframe
            className="h-full w-full overflow-y-hidden rounded-xl"
            src={iframe_src(preveri_store_index)}
          />
          {page}
        </>
      </div>
    </>
  );
}
