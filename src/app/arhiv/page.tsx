import type { Metadata } from "next";
import { Suspense } from "react";
import { Shell } from "~/components/shell";
import { page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { Search } from "./search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Arhiv novic",
	description:
		"Prebrskajte arhiv vseh objavljenih novic Jamarskega kluba Novo mesto.",
	alternates: { canonical: "/arhiv" },
};

export default function Novice() {
	return (
		<Shell>
			<div className={cn(page_variants({ max_width: "wide" }))}>
				<div className="prose mb-6">
					<h1>Arhiv novic</h1>
				</div>
				<Suspense fallback={null}>
					<Search />
				</Suspense>
			</div>
		</Shell>
	);
}
