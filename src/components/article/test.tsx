"use client";

import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function Test() {
  const create_draft = api.article.create_draft.useMutation();
  const publish_article = api.article.publish.useMutation();

  return (
    <div>
      <Button
        onClick={async () => {
          const draft = await create_draft.mutateAsync({
            title: "testing",
          });

          await publish_article.mutateAsync(draft.id);
        }}
      >
        Test
      </Button>
    </div>
  );
}
