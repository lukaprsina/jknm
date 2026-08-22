import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Shell } from "~/components/shell";
import { page_variants } from "~/lib/page-variants";
import { getServerAuthSession } from "~/server/auth";
import { CacheInvalidationForm } from "./cache-invalidation-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Cache",
	robots: { index: false, follow: false },
};

export default async function CachePage() {
	if (!(await getServerAuthSession())) notFound();

	return (
		<Shell>
			<div className={page_variants()}>
				<div className="prose mb-6">
					<h1>Počisti predpomnilnik</h1>
					<p>
						Ročno osvežite izbrane strežniške predpomnilnike. Vsebina baze se
						pri tem ne spremeni.
					</p>
				</div>
				<CacheInvalidationForm />
			</div>
		</Shell>
	);
}
