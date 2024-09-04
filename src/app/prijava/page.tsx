import SignIn from "./signin";

import "./google.css";
import { Shell } from "~/components/shell";
import { getServerAuthSession } from "~/server/auth";

export default async function Prijava() {
  const session = await getServerAuthSession();
  return (
    <Shell without_footer>
      <div className="h-screen w-full min-w-full">
        <SignIn session={session} />
      </div>
    </Shell>
  );
}
