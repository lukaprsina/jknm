import dynamic from "next/dynamic";

import { buttonVariants } from "~/components/ui/button";
import { CardContent, CardFooter } from "~/components/ui/card";

import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { InfoCard } from "~/components/info-card";
import { cn } from "~/lib/utils";
import { getServerAuthSession } from "~/server/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import MakeNewDraftButton from "~/components/article/make-new-draft-button";
import type { ResolvingMetadata, Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import { get_article_by_draft_id } from "~/server/article/get-article";

const Editor = dynamic(() => import("./editor"), {
  ssr: false,
});

interface EditorPageProps {
  params: Promise<{
    draft_id: string;
  }>;
}

export async function generateMetadata(props: EditorPageProps, _parent: ResolvingMetadata): Promise<Metadata> {
  const params = await props.params;

  const {
    draft_id
  } = params;

  const session = await getServerAuthSession();
  if (!session)
    return {
      title: "Napaka",
    };

  const decoded = decodeURIComponent(draft_id);
  const novica_id = parseInt(decoded);

  if (isNaN(novica_id))
    return {
      title: "Napaka",
    };

  const { draft } = await get_article_by_draft_id({ draft_id: novica_id });

  const title = draft
    ? DOMPurify.sanitize(draft.title, {
        ALLOWED_TAGS: [],
      })
    : "Uredi novico";

  return {
    title,
  };
}

export default async function EditorPage(props: EditorPageProps) {
  const params = await props.params;

  const {
    draft_id
  } = params;

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

  const { draft, published } = await get_article_by_draft_id({
    draft_id: novica_id,
  });

  return (
    <Shell draft_article={draft} published_article={published}>
      <div className={cn(article_variants(), page_variants(), "min-h-screen")}>
        {draft ? (
          <Editor draft={draft} published={published} />
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
          Osnutek z ID <strong>{novica_ime}</strong> ne obstaja.
        </span>
      }
      description="Preverite, če je ID pravilen."
    >
      <CardContent>
        Lahko pa ustvarite novo novičko z ID <strong>{novica_ime}</strong>.
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
