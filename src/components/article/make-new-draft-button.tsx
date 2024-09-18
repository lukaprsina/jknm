"use client";

import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import type { ButtonProps } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { article_variants } from "~/lib/page-variants";
import { get_draft_article_link } from "~/lib/article-utils";

export default function MakeNewDraftButton({
  title,
  published_article_id,
  ...props
}: ButtonProps & { title?: string; published_article_id?: number }) {
  const router = useRouter();
  const trpc_utils = api.useUtils();

  // TODO
  const create_draft = api.article.get_or_create_draft.useMutation({
    onSuccess: async (data) => {
      await trpc_utils.article.invalidate();
      router.push(get_draft_article_link(data.id));
    },
  });

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              {...props}
              onClick={() => {
                create_draft.mutate({
                  article: get_content_from_title(title),
                  published_id: published_article_id,
                });
              }}
            />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Ustvari novico</TooltipContent>
      </Tooltip>
      <PopoverContent
        className={cn(
          "relative z-[150] mx-6 w-80",
          article_variants({ variant: "card" }),
        )}
      >
        <h3>Ustvarjamo novo novico.</h3>
        <span className="flex items-center gap-2">
          <LoadingSpinner /> Prosimo, da malo počakate.
        </span>
      </PopoverContent>
    </Popover>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("animate-spin", className)}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function get_content_from_title(title?: string) {
  const new_title = title ?? "Nova novica";

  const content = {
    blocks: [
      {
        id: "sheNwCUP5A",
        type: "header",
        data: {
          text: new_title,
          level: 1,
        },
      },
    ],
  };

  return {
    title: new_title,
    content,
  };
}
