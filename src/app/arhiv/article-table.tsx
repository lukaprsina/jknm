"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import type { UseInfiniteHitsProps } from "react-instantsearch";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from "lucide-react";
import { useSortBy } from "react-instantsearch";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { format_date_for_human } from "~/lib/format-date";
import { MyStats, SORT_BY_ITEMS } from "./components";
import type { Session } from "next-auth";
import type { PublishedArticleHit } from "~/lib/validators";
import { Authors } from "~/components/authors";
import { get_published_article_link } from "~/lib/article-utils";
import { useInfiniteAlgoliaArticles } from "~/hooks/use-infinite-algolia";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "~/hooks/use-toast";
import { delete_both } from "~/server/article/delete";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import type { delete_both_validator } from "~/server/article/validators";
import type { IntersectionRef } from "../infinite-no-trpc";
import { use } from "react";
import { DuplicateURLsContext } from "../provider";

export function ArticleTable({
  session,
  ...props
}: { session: Session | null } & UseInfiniteHitsProps<PublishedArticleHit>) {
  const sort_api = useSortBy({
    items: SORT_BY_ITEMS,
  });

  const { load_more_ref, items } = useInfiniteAlgoliaArticles({
    offset: 20,
    ...props,
  });

  return (
    <Table>
      {/* <TableCaption>Novice.</TableCaption> */}
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>
            <Button
              variant="ghost"
              onClick={() => {
                sort_api.refine(
                  sort_api.currentRefinement === "published_article_title_desc"
                    ? "published_article_title_asc"
                    : "published_article_title_desc",
                );
              }}
            >
              Naslov
              {sort_api.currentRefinement ===
                "published_article_title_desc" && <ChevronDownIcon />}
              {sort_api.currentRefinement === "published_article_title_asc" && (
                <ChevronUpIcon />
              )}
            </Button>
          </TableHead>
          <TableHead>Avtorji</TableHead>
          <TableHead>
            <Button
              variant="ghost"
              onClick={() => {
                sort_api.refine(
                  sort_api.currentRefinement ===
                    "published_article_created_at_desc"
                    ? "published_article_created_at_asc"
                    : "published_article_created_at_desc",
                );
              }}
            >
              Datum nastanka
              {sort_api.currentRefinement ===
                "published_article_created_at_desc" && <ChevronDownIcon />}
              {sort_api.currentRefinement ===
                "published_article_created_at_asc" && <ChevronUpIcon />}
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              onClick={() => {
                sort_api.refine(
                  sort_api.currentRefinement ===
                    "published_article_updated_at_desc"
                    ? "published_article_updated_at_asc"
                    : "published_article_updated_at_desc",
                );
              }}
            >
              Zadnje posodobljeno
              {sort_api.currentRefinement ===
                "published_article_updated_at_desc" && <ChevronDownIcon />}
              {sort_api.currentRefinement ===
                "published_article_updated_at_asc" && <ChevronUpIcon />}
            </Button>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <ArticleTableRow
            hit={item}
            session={session}
            key={item.objectID}
            ref={load_more_ref(index)}
          />
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}></TableCell>
          <TableCell className="text-right">
            <MyStats />
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function ArticleTableRow({
  ref,
  hit,
  session: _,
}: {
  ref?: IntersectionRef;
  hit: SearchHit<PublishedArticleHit>;
  session: Session | null;
}) {
  const duplicate_urls = use(DuplicateURLsContext);

  return (
    <TableRow ref={ref} key={hit.objectID}>
      <TableCell>{hit.objectID}</TableCell>
      <TableCell className="font-medium">
        <Button variant="link" asChild>
          <Link
            href={get_published_article_link(
              hit.url,
              hit.created_at,
              duplicate_urls,
            )}
          >
            {hit.title}
          </Link>
        </Button>
      </TableCell>
      <TableCell>
        <Authors author_ids={hit.author_ids} />
      </TableCell>
      <TableCell>{format_date_for_human(new Date(hit.created_at))}</TableCell>
      <TableCell>{format_date_for_human(new Date(hit.updated_at))}</TableCell>
    </TableRow>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DeleteDialog({ article_id }: { article_id: number }) {
  // const trpc_utils = api.useUtils();

  /* const article_delete = api.article.delete_both.useMutation({
    onSuccess: async () => {
      await trpc_utils.article.invalidate();
    },
  }); */
  const toaster = useToast();
  const router = useRouter();
  const query_client = useQueryClient();

  const delete_both_mutation = useMutation({
    mutationFn: (input: z.infer<typeof delete_both_validator>) =>
      delete_both(input),
    onSettled: async () => {
      await query_client.invalidateQueries({
        queryKey: ["infinite_published"],
      });
      /* await trpc_utils.article.invalidate();
      await trpc_utils.article.get_infinite_published.invalidate(); */
      router.replace(`/`);
    },
    onError: (error) => {
      toaster.toast({
        title: "Napaka pri brisanju novičke",
        description: error.message,
      });
    },
  });

  return (
    <AlertDialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon">
              <TrashIcon size={18} />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Zbriši novico</TooltipContent>
      </Tooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zbriši novico</AlertDialogTitle>
          <AlertDialogDescription>
            Ste prepričani, da želite zbrisati novico?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Prekliči</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              delete_both_mutation.mutate({ draft_id: article_id });
            }}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
