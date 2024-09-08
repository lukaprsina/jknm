import Link from "next/link";
import { buttonVariants } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { getServerAuthSession } from "~/server/auth";
import { SignOut } from "./auth";

export async function Footer() {
  const session = await getServerAuthSession();

  return (
    <>
      <Separator />
      <footer className="py-6 md:px-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            Jamarski klub Novo mesto
          </p>
          <div>
            {session?.user ? (
              <>
                <SignOut />
              </>
            ) : (
              <>
                <Link
                  href="/prijava"
                  className={buttonVariants({ variant: "link" })}
                >
                  Prijava
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
