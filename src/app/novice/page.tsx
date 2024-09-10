import { getServerAuthSession } from "~/server/auth";
import { Shell } from "../../components/shell";
import { cn } from "~/lib/utils";
import { page_variants } from "~/lib/page-variants";
import { Search } from "./search";

export default async function Novice() {
  const session = await getServerAuthSession();

  return (
    <Shell>
      <div className={cn(page_variants())}>
        <Search session={session} />
      </div>
    </Shell>
  );
}
