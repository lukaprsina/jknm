"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import type { UseHitsProps } from "react-instantsearch";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from "lucide-react";
import { useHits, useSortBy } from "react-instantsearch";

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
import { api } from "~/trpc/react";
import { MyStats, SORT_BY_ITEMS } from "./search-components";
import type { Session } from "next-auth";
import type { PublishedArticleHit } from "~/lib/validators";
import { Authors } from "~/components/authors";
import { get_published_article_link } from "~/lib/article-utils";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";

export function ArticleTable({
  session,
  ...props
}: { session: Session | null } & UseHitsProps<PublishedArticleHit>) {
  const { items } = useHits(props);
  const sort_api = useSortBy({
    items: SORT_BY_ITEMS,
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
        {items.map((item) => (
          <ArticleTableRow hit={item} session={session} key={item.objectID} />
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
  hit,
  session: _,
}: {
  hit: SearchHit<PublishedArticleHit>;
  session: Session | null;
}) {
  const duplicate_urls = useDuplicatedUrls();

  return (
    <TableRow key={hit.objectID}>
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
  const trpc_utils = api.useUtils();

  // TODO
  const article_delete = api.article.delete_both.useMutation({
    onSuccess: async () => {
      await trpc_utils.article.invalidate();
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
              article_delete.mutate({ draft_id: article_id });
            }}
          >
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
