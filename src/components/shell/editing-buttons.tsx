"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";

import { content_to_text } from "~/lib/content-to-text";
import { api } from "~/trpc/react";
import PublishedArticleContext from "../article/context";
import type { Session } from "next-auth";
import MakeDraftButton from "../article/make-draft-button";
import { Button, ButtonProps } from "~/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@radix-ui/react-tooltip";

export default function EditingButtons({
  session,
}: {
  session: Session | null;
}) {
  const article = useContext(PublishedArticleContext);

  if (!session) return null;

  return (
    <>
      {article && (
        <EditButton
          id={article.id}
          url={article.url}
          content_preview={content_to_text(article.content ?? undefined)}
          // has_draft={!!article.draft_content}
        />
      )}
      <MakeDraftButton
        className="dark:bg-primary/80 dark:text-primary-foreground"
        variant="ghost"
        size="icon"
      >
        <PlusIcon size={24} />
      </MakeDraftButton>
    </>
  );
}

export function EditButton({
  id,
  url,
  content_preview,
  is_draft,
  new_tab,
  variant = "ghost",
}: {
  id: number;
  url: string;
  content_preview?: string;
  is_draft?: boolean;
  new_tab?: boolean;
  variant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  const trpc_utils = api.useUtils();
  const all_authors = api.author.get_authors.useQuery();

  const article_create_draft = api.article.create_draft.useMutation({
    onSuccess: async (data) => {
      const returned_data = data?.at(0);
      if (!returned_data) return;

      // TODO
      /* await create_algolia_article({
        objectID: returned_data.id.toString(),
        title: returned_data.title,
        url: returned_data.url,
        content_preview: content_preview ?? "",
        image: returned_data.preview_image ?? "",
        created_at: returned_data.created_at.getTime(),
        published: !!returned_data.published,
        has_draft: !!returned_data.draft_content,
        year: returned_data.created_at.getFullYear().toString(),
        author_names: get_author_names(returned_data, all_authors.data),
      }); */

      await trpc_utils.article.invalidate();

      // console.log("/uredi", generate_encoded_url(returned_data));
      const new_url = `/uredi/${returned_data.id}`;
      if (new_tab) {
        window.open(new_url, "_blank");
      } else {
        router.push(new_url);
      }
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="flex flex-shrink-0 dark:bg-primary/80 dark:text-primary-foreground"
          variant={variant}
          size="icon"
          onClick={() => {
            // console.log({ has_draft });
            const new_url = `/uredi/${id})}`;

            if (is_draft) {
              if (new_tab) {
                window.open(new_url, "_blank");
              } else {
                router.push(new_url);
              }
            } else {
              // TODO
              /* article_create_draft.mutate({
                id,
              }); */
            }
          }}
        >
          <PencilIcon size={20} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Uredi</TooltipContent>
    </Tooltip>
  );
}
