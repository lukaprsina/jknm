import { getServerAuthSession } from "~/server/auth";
import { Shell } from "~/components/shell";
import { cn } from "~/lib/utils";
import { page_variants } from "~/lib/page-variants";
import { Search } from "./search";
import { Authors } from "~/components/authors";

export default async function Novice() {
  const session = await getServerAuthSession();

  return (
    <Shell>
      <div className={cn(page_variants())}>
        <Search
          session={session}
          authors={(author_ids: number[]) => (
            <Authors author_ids={author_ids} />
          )}
        />
      </div>
    </Shell>
  );
}
