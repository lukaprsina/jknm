"use client";

import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";

import { content_to_text } from "~/lib/content-to-text";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import type { ButtonProps } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { useAllAuthors } from "../authors";

export default function MakeDraftButton({
  title,
  url,
  ...props
}: ButtonProps & { title?: string; url?: string }) {
  const router = useRouter();
  const trpc_utils = api.useUtils();
  const all_authors = useAllAuthors();

  const article_create = api.article.create_draft.useMutation({
    onSuccess: async (returned_data) => {
      console.log("new article loader", returned_data);
      const content_preview = content_to_text(
        returned_data.content?.blocks ?? undefined,
      );
      // if (!content_preview) return;

      // TODO
      /* await create_algolia_article({
        objectID: returned_data.id.toString(),
        title: returned_data.title,
        url: returned_data.url,
        content_preview,
        created_at: returned_data.created_at.getTime(),
        published: !!returned_data.published,
        has_draft: !!returned_data.draft_content,
        year: returned_data.created_at.getFullYear().toString(),
        author_names: get_author_names(returned_data, all_authors.data),
      }); */

      await trpc_utils.article.invalidate();

      // console.log("/uredi", generate_encoded_url(returned_data));
      router.push(`/uredi/${returned_data.id}`);
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          {...props}
          onClick={() => {
            const article_title = title ?? "Nova novica";
            const article_url = url ?? `nova-novica`;

            const template = {
              blocks: [
                {
                  id: "sheNwCUP5A",
                  type: "header",
                  data: {
                    text: article_title,
                    level: 1,
                  },
                },
              ],
            };

            article_create.mutate({
              title: article_title,
              preview_image: "",
              content: template,
              updated_at: new Date(),
            });
          }}
        />
      </PopoverTrigger>
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
