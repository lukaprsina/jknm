import { redirect } from "next/navigation";

import { auth } from "@acme/auth";

import { Shell } from "~/components/shell";
import { ArticleConverter } from "./converter-editor";

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  return (
    <Shell>
      <ArticleConverter />
    </Shell>
  );
}
