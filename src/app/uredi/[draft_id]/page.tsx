import dynamic from "next/dynamic";

import { buttonVariants } from "~/components/ui/button";
import { CardContent, CardFooter } from "~/components/ui/card";

import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { api } from "~/trpc/server";
import { InfoCard } from "~/components/info-card";
import { cn } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import MakeNewDraftButton from "~/components/article/make-new-draft-button";

const Editor = dynamic(() => import("./editor"), {
  ssr: false,
});

interface EditorPageProps {
  params: {
    draft_id: string;
  };
}

export default async function EditorPage({
  params: { draft_id },
}: EditorPageProps) {
  const session = await getServerAuthSession();
  if (!session) return notFound();

  const decoded = decodeURIComponent(draft_id);
  const novica_id = parseInt(decoded);

  if (isNaN(novica_id)) {
    return (
      <Shell>
        <InfoCard title="Napaka" description="Neveljaven URL novičke." />
      </Shell>
    );
  }

  const { draft, published } =
    await api.article.get_article_by_draft_id(novica_id);

  return (
    <Shell draft_article={draft} published_article={published}>
      <div className={cn(article_variants(), page_variants(), "min-h-screen")}>
        {draft ? (
          <Editor draft={draft} />
        ) : (
          <CreateNewArticle novica_ime={draft_id} />
        )}
      </div>
    </Shell>
  );
}

function CreateNewArticle({ novica_ime }: { novica_ime: string }) {
  return (
    <InfoCard
      title={
        <span>
          Novička <strong>{novica_ime}</strong> ne obstaja.
        </span>
      }
      description="Preverite, če ste vnesli pravilno ime novičke."
    >
      <CardContent>
        Lahko pa ustvarite novo novičko z imenom <strong>{novica_ime}</strong>.
      </CardContent>
      <CardFooter className="flex justify-between">
        <Link className={buttonVariants({ variant: "secondary" })} href="/">
          Domov
        </Link>
        <MakeNewDraftButton title={novica_ime} children="Ustvari novico" />
      </CardFooter>
    </InfoCard>
  );
}
