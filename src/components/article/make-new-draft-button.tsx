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
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { get_content_from_title } from "~/lib/content-from-title";

export default function MakeNewDraftButton({
  title,
  published_article_id,
  ...props
}: ButtonProps & { title?: string; published_article_id?: number }) {
  const router = useRouter();
  const trpc_utils = api.useUtils();

  const create_draft = api.article.get_or_create_draft.useMutation({
    onSuccess: async (data) => {
      await trpc_utils.article.invalidate();
      router.push(`/uredi/${data.id}`);
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
      <PopoverContent className="relative z-[150] mx-6 w-80">
        <Card>
          <CardHeader>
            <CardTitle>Ustvarjamo novo novico.</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-between gap-4">
            <LoadingSpinner /> Prosimo, da malo počakate.
          </CardContent>
        </Card>
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
