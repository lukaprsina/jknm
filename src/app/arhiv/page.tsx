import type { Metadata } from "next";
import { Shell } from "~/components/shell";
import { page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import { Search } from "./search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	alternates: { canonical: "/arhiv" },
};

export default async function Novice() {
	const session = await getServerAuthSession();

	return (
		<Shell>
			<div className={cn(page_variants({ max_width: "wide" }))}>
				{/* <Search2 /> */}
				<Search session={session} />
			</div>
		</Shell>
	);
}
