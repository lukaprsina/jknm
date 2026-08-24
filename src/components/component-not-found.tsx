import Link from "next/link";
import { CONTACT_EMAIL } from "~/lib/domains";
import { page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";

export function NotFoundContent({
	title,
	description,
	children,
}: {
	title: string | React.ReactNode;
	description?: string | React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<div className={cn(page_variants({ max_width: "wide" }), "prose")}>
			<h1>{title}</h1>
			{description && <p>{description}</p>}
			{children}
		</div>
	);
}

export function ArticleNotFound() {
	return (
		<NotFoundContent
			title="Novica ne obstaja"
			description="Prosim, preverite URL naslov in poskusite znova."
		>
			<p>Če menite, da je prišlo do napake, nas kontaktirajte.</p>
			<p>
				Naša e-pošta:{" "}
				<Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>
			</p>
		</NotFoundContent>
	);
}
