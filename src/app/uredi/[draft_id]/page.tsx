import dynamic from "next/dynamic";

import { Button } from "~/components/ui/button";
import { CardContent, CardFooter } from "~/components/ui/card";

import NewArticleLoader from "~/components/new-article-loader";
import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { api } from "~/trpc/server";
import { InfoCard } from "~/components/info-card";
import { cn } from "~/lib/utils";
import { convert_title_to_url } from "~/lib/article-utils";
import { getServerAuthSession } from "~/server/auth";
import { notFound } from "next/navigation";
import {
  DraftArticleContext,
  PublishedArticleContext,
} from "~/components/article/context";

const Editor = dynamic(() => import("./editor"), {
  ssr: false,
});

interface EditorPageProps {
  params: {
    novica_ime: string;
  };
}

export default async function EditorPage({
  params: { novica_ime },
}: EditorPageProps) {
  const session = await getServerAuthSession();
  if (!session) return notFound();

  const decoded = decodeURIComponent(novica_ime);

  const novica_id = parseInt(decoded);
  if (isNaN(novica_id)) {
    return (
      <Shell>
        <InfoCard title="Napaka" description="Neveljaven URL novičke." />
      </Shell>
    );
  }

  const { draft, published } =
    await api.article.get_draft_and_published_by_id(novica_id);

  return (
    <PublishedArticleContext.Provider value={published}>
      <DraftArticleContext.Provider value={draft}>
        <Shell>
          <div
            className={cn(article_variants(), page_variants(), "min-h-screen")}
          >
            {draft ? <Editor /> : <CreateNewArticle novica_ime={novica_ime} />}
          </div>
        </Shell>
      </DraftArticleContext.Provider>
    </PublishedArticleContext.Provider>
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
        <Button asChild variant="secondary">
          <a href="/">Domov</a>
        </Button>
        <NewArticleLoader
          title={novica_ime}
          url={convert_title_to_url(novica_ime)}
          children="Ustvari novico"
        />
      </CardFooter>
    </InfoCard>
  );
}
