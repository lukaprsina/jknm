import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

export function Test() {
  const publish_article = api.article.publish.useMutation();

  return (
    <div>
      <Button
        onClick={() => {
          publish_article.mutate({
            created_at: new Date(),
            draft_id: 0,
          });
        }}
      >
        Test
      </Button>
    </div>
  );
}
