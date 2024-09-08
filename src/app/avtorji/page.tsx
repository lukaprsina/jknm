import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";

const AuthorsDataTableDynamic = dynamic(
  () =>
    import("~/components/settings/authors-table").then(
      (mod) => mod.AuthorsDataTable,
    ),
  {
    ssr: false,
  },
);

export default async function Authors() {
  const session = await getServerAuthSession();
  if (!session) redirect("/");

  return (
    <Shell>
      <div className={cn(page_variants(), article_variants())}>
        <AuthorsDataTableDynamic />
      </div>
    </Shell>
  );
}
