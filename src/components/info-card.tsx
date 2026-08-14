import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";

export function InfoCard({
	title,
	description,
	children,
}: {
	title: string | React.ReactNode;
	description?: string | React.ReactNode;
	children?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				page_variants(),
				article_variants(),
				"flex h-full items-center justify-center prose-h3:m-0",
			)}
		>
			<Card>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					{description && <CardDescription>{description}</CardDescription>}
					{children}
				</CardHeader>
			</Card>
		</div>
	);
}
