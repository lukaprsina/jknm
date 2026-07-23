import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import { AuthorsDataTable } from "./table";

/* const AuthorsDataTable = dynamic(
  () => import("~/app/avtorji/table").then((mod) => mod.AuthorsDataTable),
  {
    ssr: false,
  },
); */

export default async function Authors() {
	const session = await getServerAuthSession();
	if (!session) redirect("/");

	return (
		<Shell>
			<div className={cn(page_variants(), article_variants())}>
				<Suspense fallback={null}>
					<AuthorsDataTable />
				</Suspense>
			</div>
		</Shell>
	);
}
