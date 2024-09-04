import { redirect } from "next/navigation";

import { Shell } from "~/components/shell";
import { ArticleConverter } from "./converter-editor";
import { getServerSession } from "next-auth";

export default async function Page() {
  const session = await getServerSession();

  if (!session) {
    redirect("/");
  }

  return (
    <Shell>
      <ArticleConverter />
    </Shell>
  );
}
