"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon } from "lucide-react";

import { api } from "~/trpc/react";
import type { Session } from "next-auth";
import MakeNewDraftButton from "../article/make-new-draft-button";
import { Button } from "~/components/ui/button";
import type { ButtonProps } from "~/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "~/components/ui/tooltip";
import { SettingsDropdown } from "../settings";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "../article/adapter";
import { get_draft_article_link } from "~/lib/article-utils";

export default function EditingButtons({
  published_article,
  session,
}: {
  published_article?: PublishedArticleWithAuthors;
  draft_article?: DraftArticleWithAuthors;
  session: Session | null;
}) {
  /* useEffect(() => {
    console.log("EditingButtons", { published_article });
  }); */

  if (!session) return null;

  return (
    <>
      {published_article && (
        <EditButton
          variant="ghost"
          published_article_id={published_article.id}
        />
      )}
      <MakeNewDraftButton
        className="dark:bg-primary/80 dark:text-primary-foreground"
        variant="ghost"
        size="icon"
      >
        <PlusIcon size={24} />
      </MakeNewDraftButton>
      <SettingsDropdown />
    </>
  );
}

export function EditButton({
  new_tab,
  published_article_id,
  ...props
}: ButtonProps & {
  new_tab?: boolean;
  published_article_id: number;
}) {
  const router = useRouter();
  const trpc_utils = api.useUtils();

  const handle_navigation = useCallback(
    (id: number) => {
      const new_url = get_draft_article_link(id);

      if (new_tab) {
        window.open(new_url, "_blank");
      } else {
        router.push(new_url);
      }
    },
    [new_tab, router],
  );

  // TODO
  const get_or_create_draft = api.article.get_or_create_draft.useMutation({
    onSuccess: async (data) => {
      await trpc_utils.article.invalidate();
      handle_navigation(data.id);
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="flex flex-shrink-0 dark:bg-primary/80 dark:text-primary-foreground"
          size="icon"
          onClick={() => {
            get_or_create_draft.mutate({
              published_id: published_article_id,
            });
          }}
          {...props}
        >
          <PencilIcon size={20} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Uredi</TooltipContent>
    </Tooltip>
  );
}
