"use client";

import { signIn, signOut } from "next-auth/react";
import { Button } from "../ui/button";

export function SignInGoogle() {
  return <Button onClick={async () => await signIn()}>L</Button>;
}

export function SignOut() {
  return <Button onClick={async () => await signOut()}>W</Button>;
}
