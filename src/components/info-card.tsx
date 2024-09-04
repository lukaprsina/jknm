import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";

export function InfoCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        page_variants(),
        "flex min-h-screen items-center justify-center",
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
