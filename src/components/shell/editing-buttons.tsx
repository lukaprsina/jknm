"use client";

import { useEffect } from "react";
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
import type { PublishedArticleWithAuthors } from "../article/card-adapter";
import { get_content_from_title } from "~/lib/content-from-title";

export default function EditingButtons({
  article,
  session,
}: {
  article?: PublishedArticleWithAuthors;
  session: Session | null;
}) {
  useEffect(() => {
    console.log("EditingButtons", { article });
  });

  if (!session) return null;

  return (
    <>
      {article && <EditButton id={article.id} />}
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
  id,
  new_tab,
  variant = "ghost",
}: {
  id: number;
  new_tab?: boolean;
  variant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  const trpc_utils = api.useUtils();

  const create_draft = api.article.create_draft.useMutation({
    onSuccess: async () => {
      await trpc_utils.article.invalidate();
      const new_url = `/uredi/${id}`;

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
            create_draft.mutate(get_content_from_title());
          }}
        >
          <PencilIcon size={20} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Uredi</TooltipContent>
    </Tooltip>
  );
}
