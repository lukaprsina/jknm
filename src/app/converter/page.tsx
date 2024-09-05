import { redirect } from "next/navigation";

import { Shell } from "~/components/shell";
import { getServerAuthSession } from "~/server/auth";
import dynamic from "next/dynamic";

const DynamicArticleConverter = dynamic(
  () => import("./converter-editor").then((mod) => mod.ArticleConverter),
  {
    ssr: false,
  },
);

export default async function Page() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect("/");
  }

  return (
    <Shell>
      <DynamicArticleConverter />
    </Shell>
  );
}
