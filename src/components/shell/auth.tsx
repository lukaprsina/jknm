"use client";

import { signOut } from "next-auth/react";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();

  return (
    <Button
      onClick={async () => {
        await signOut();
        router.push("/");
      }}
    >
      Odjava
    </Button>
  );
}
