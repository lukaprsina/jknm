"use client";

import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

import { Button } from "~/components/ui/button";
import type { ButtonProps } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { article_variants } from "~/lib/page-variants";
import { get_draft_article_link } from "~/lib/article-utils";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { create_draft } from "~/server/article/create-draft";
import type { z } from "zod";
import type { create_draft_validator } from "~/server/article/validators";

export default function MakeNewDraftButton({
  title,
  ...props
}: ButtonProps & { title?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const create_draft_mutation = useMutation({
    mutationFn: (input: z.infer<typeof create_draft_validator>) =>
      create_draft(input),
    onSuccess: (data) => {
      router.push(get_draft_article_link(data.id));
    },
    onSettled: (data, e) => {
      console.log("get_or_create_draft", { data, e });
      setOpen(false);
    },
  });
  // const trpc_utils = api.useUtils();

  // TODO
  /* const create_draft = api.article.get_or_create_draft.useMutation({
    onSuccess: async (data) => {
      await trpc_utils.article.invalidate();
      router.push(get_draft_article_link(data.id));
    },
  }); */

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              {...props}
              onClick={() => {
                create_draft_mutation.mutate({ title: title ?? "Nova novica" });
                /* create_draft.mutate({
                  article: get_content_from_title(title),
                }); */
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
