"use client";

import { signIn, signOut } from "next-auth/react";
import { Button } from "../ui/button";

export function SignIn() {
  return <Button onClick={async () => await signIn("google")}>Admin</Button>;
}

export function SignOut() {
  return <Button onClick={async () => await signOut()}>Odjava</Button>;
}
