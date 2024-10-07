import { cn } from "~/lib/utils";
import { page_variants } from "~/lib/page-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import Link from "next/link";


export function ArticleNotFound() {
  return (
    <div
      className={cn(
        page_variants(),
        "prose flex min-h-screen items-center justify-center",
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle>Novica ne obstaja</CardTitle>
          <CardDescription>
            Prosim, preverite URL naslov in poskusite znova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Če menite, da je prišlo do napake, nas kontaktirajte.</p>
          <p>Naša e-pošta: </p>
          <Link href="mailto:info@jknm.si">info@jknm.si</Link>
        </CardContent>
      </Card>
    </div>
  );
}